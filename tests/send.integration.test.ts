import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChannelProvider } from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { upsertSmsChannelConfig } from "@/lib/channel-config/service";
import { ensureDefaultContactCategories } from "@/lib/contacts/categories";
import { createContact } from "@/lib/contacts/service";
import {
  QueueInvalidStateError,
  QueueNotFoundError,
} from "@/lib/queue/errors";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { claimQueueItemsForOrganization } from "@/lib/queue/claim";
import { generateOccasionQueue } from "@/lib/queue/generate";
import {
  processClaimedQueueItem,
  retryQueueItem,
  scheduleQueueRetry,
  sendQueueItem,
  sendQueueItems,
} from "@/lib/queue/send";
import { listDeliveries } from "@/lib/deliveries/list";
import { createTemplate } from "@/lib/templates/service";
import { sendQueueSchema } from "@/lib/validation/send";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;



function failTestMobile() {
  return indianProviderFailMobile();
}

function registerInput(suffix: string) {
  return {
    organizationName: `Send Org ${suffix}`,
    organizationSlug: `send-org-${suffix}`,
    timezone: "UTC",
    adminName: "Send Admin",
    email: `send-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

async function setupQueueItem(options?: { failMobile?: boolean }) {
  const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
  await upsertSmsChannelConfig(org.organization.id, {
    provider: ChannelProvider.TEST,
    isActive: true,
  });
  const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
  const template = await createTemplate(org.organization.id, {
    name: "Birthday SMS",
    occasionId: birthday.id,
    channel: "SMS",
    body: "Happy Birthday {{name}}!",
    isActive: true,
  });
  await prisma.categoryAutomationRule.create({
    data: {
      organizationId: org.organization.id,
      occasionId: birthday.id,
      categoryId: null,
      sendHour: 0,
      sendMinute: 0,
      smsEnabled: true,
      smsTemplateId: template.id,
    },
  });
  const contact = await createContact(org.organization.id, {
    name: options?.failMobile ? "Fail Person" : "Send Person",
    mobile: options?.failMobile ? failTestMobile() : testMobile(),
    occasionDates: { [birthday.id]: "1990-07-11" },

    isActive: true,
  });

  await generateOccasionQueue(org.organization.id, birthday.id, {
    templateId: template.id,
    targetDate: "2026-07-11",
  });

  const queue = await prisma.sendQueue.findFirstOrThrow({
    where: { organizationId: org.organization.id, contactId: contact.id },
  });

  return { org, contact, template, queue, birthday };
}

describe("message sending", () => {
  beforeAll(async () => {
    if (!databaseUrl) {
      return;
    }

    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects client-supplied organizationId in send schema", () => {
    const parsed = sendQueueSchema.safeParse({
      queueIds: ["queue-1"],
      organizationId: "other-org",
    });

    expect(parsed.success).toBe(false);
  });

  it("sends a pending queue item to SENT", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org, queue } = await setupQueueItem();
    const before = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: org.organization.id },
    });

    const result = await sendQueueItem(org.organization.id, queue.id);

    expect(result.status).toBe("sent");
    expect(result.queue?.status).toBe("SENT");
    expect(result.queue?.attemptCount).toBe(1);

    const logs = await listDeliveries(org.organization.id, {
      page: 1,
      limit: 10,
      sendQueueId: queue.id,
    });
    expect(logs.data).toHaveLength(1);
    expect(logs.data[0]?.provider).toBe("TEST");
    expect(logs.data[0]?.providerMessageId).toContain("test-");

    const after = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: org.organization.id },
    });
    expect(after.messagesSentThisMonth).toBe(before.messagesSentThisMonth);

    await cleanupOrganization(org.organization.id);
  });

  it("fails deterministically and can be retried to SENT", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org, queue } = await setupQueueItem({ failMobile: true });
    const beforeUsage = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: org.organization.id },
    });

    const failed = await sendQueueItem(org.organization.id, queue.id);
    expect(failed.status).toBe("retry_scheduled");
    expect(failed.queue?.status).toBe("FAILED");

    const scheduled = await scheduleQueueRetry(org.organization.id, queue.id);
    expect(scheduled.status).toBe("scheduled");
    expect(scheduled.queue.status).toBe("FAILED");
    expect(scheduled.queue.nextAttemptAt).not.toBeNull();

    const claimed = await claimQueueItemsForOrganization(org.organization.id);
    expect(claimed.map((item) => item.id)).toContain(queue.id);

    const retried = await processClaimedQueueItem(
      org.organization.id,
      queue.id,
    );
    expect(retried.status).toBe("sent");
    expect(retried.queue?.status).toBe("SENT");
    expect(retried.queue?.attemptCount).toBe(2);

    const afterUsage = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: org.organization.id },
    });
    expect(afterUsage.messagesSentThisMonth).toBe(
      beforeUsage.messagesSentThisMonth,
    );

    const logs = await listDeliveries(org.organization.id, {
      page: 1,
      limit: 10,
      sendQueueId: queue.id,
    });
    expect(logs.data).toHaveLength(2);
    expect(logs.data[0]?.attemptNumber).toBe(2);
    expect(logs.data[1]?.attemptNumber).toBe(1);

    await cleanupOrganization(org.organization.id);
  });

  it("does not send SENT queue items again", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org, queue } = await setupQueueItem();
    await sendQueueItem(org.organization.id, queue.id);

    const again = await sendQueueItem(org.organization.id, queue.id);
    expect(again.status).toBe("skipped");

    await cleanupOrganization(org.organization.id);
  });

  it("prevents cross-tenant send access", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org, queue } = await setupQueueItem();
    const other = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await expect(
      sendQueueItem(other.organization.id, queue.id),
    ).rejects.toBeInstanceOf(QueueNotFoundError);

    await cleanupOrganization(org.organization.id);
    await cleanupOrganization(other.organization.id);
  });

  it("uses stored renderedBody snapshot when sending", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org, contact, queue } = await setupQueueItem();
    await prisma.contact.update({
      where: { id: contact.id },
      data: { name: "Changed After Queue" },
    });

    const result = await sendQueueItem(org.organization.id, queue.id);
    expect(result.queue?.renderedPreview).toContain("Send Person");

    const stored = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(stored.renderedBody).toBe("Happy Birthday Send Person!");

    await cleanupOrganization(org.organization.id);
  });

  it("uses category automation send time when org-level send time is not set", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    await upsertSmsChannelConfig(org.organization.id, {
      provider: ChannelProvider.TEST,
      isActive: true,
    });
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    await ensureDefaultContactCategories(org.organization.id);
    const friend = await prisma.contactCategoryDefinition.findFirstOrThrow({
      where: { organizationId: org.organization.id, name: "Friend" },
    });
    const template = await createTemplate(org.organization.id, {
      name: "Birthday Friend SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });
    const contact = await createContact(org.organization.id, {
      name: "Category Timed Person",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      categoryId: friend.id,
      isActive: true,
    });

    await prisma.categoryAutomationRule.create({
      data: {
        organizationId: org.organization.id,
        occasionId: birthday.id,
        categoryId: friend.id,
        sendHour: 15,
        sendMinute: 15,
        smsEnabled: true,
        smsTemplateId: template.id,
      },
    });
    await generateOccasionQueue(
      org.organization.id,
      birthday.id,
      {
        templateId: template.id,
        targetDate: "2026-07-11",
      },
      {
        categoryRules: [
          {
            categoryId: friend.id,
            sendHour: 15,
            sendMinute: 15,
            templateId: template.id,
          },
        ],
        referenceDate: new Date("2026-07-11T10:00:00.000Z"),
      },
    );

    const queue = await prisma.sendQueue.findFirstOrThrow({
      where: {
        organizationId: org.organization.id,
        contactId: contact.id,
      },
    });

    const result = await sendQueueItem(org.organization.id, queue.id, "send", {
      now: new Date("2026-07-11T10:05:00.000Z"),
    });

    expect(result.status).toBe("sent");
    expect(result.queue?.status).toBe("SENT");

    await cleanupOrganization(org.organization.id);
  });

  it("batch sends multiple queue items independently", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    await upsertSmsChannelConfig(org.organization.id, {
      provider: ChannelProvider.TEST,
      isActive: true,
    });
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(org.organization.id, {
      name: "Birthday SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });
    await prisma.categoryAutomationRule.create({
      data: {
        organizationId: org.organization.id,
        occasionId: birthday.id,
        categoryId: null,
        sendHour: 0,
        sendMinute: 0,
        smsEnabled: true,
        smsTemplateId: template.id,
      },
    });

    await createContact(org.organization.id, {
      name: "One",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },

      isActive: true,
    });
    await createContact(org.organization.id, {
      name: "Two",
      mobile: failTestMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },

      isActive: true,
    });

    await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });

    const queueItems = await prisma.sendQueue.findMany({
      where: { organizationId: org.organization.id },
    });

    const summary = await sendQueueItems(
      org.organization.id,
      queueItems.map((item) => item.id),
    );

    expect(summary.requested).toBe(2);
    expect(summary.sent).toBe(1);
    expect(summary.retryScheduled).toBe(1);

    await cleanupOrganization(org.organization.id);
  });

  it("scopes delivery listing to the tenant", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org, queue } = await setupQueueItem();
    await sendQueueItem(org.organization.id, queue.id);
    const other = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    const orgLogs = await listDeliveries(org.organization.id, {
      page: 1,
      limit: 10,
    });
    const otherLogs = await listDeliveries(other.organization.id, {
      page: 1,
      limit: 10,
    });

    expect(orgLogs.data.length).toBeGreaterThan(0);
    expect(otherLogs.data).toHaveLength(0);

    await cleanupOrganization(org.organization.id);
    await cleanupOrganization(other.organization.id);
  });

  it("cannot retry pending queue items", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org, queue } = await setupQueueItem();

    await expect(
      retryQueueItem(org.organization.id, queue.id),
    ).rejects.toBeInstanceOf(QueueInvalidStateError);

    await cleanupOrganization(org.organization.id);
  });
});
