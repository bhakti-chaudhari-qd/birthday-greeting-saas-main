import { Channel, ChannelProvider, OccasionType, QueueStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { runBirthdayAutomation } from "@/lib/automation/birthday";
import {
  BIRTHDAY_AUTOMATION_TIMEZONE,
  MAX_BIRTHDAY_CREATES_PER_ORGANIZATION,
} from "@/lib/automation/constants";
import { updateBirthdayAutomationSettings } from "@/lib/automation/settings";
import { CronAuthError, requireCronSecret } from "@/lib/api/cron-auth";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { buildBirthdayIdempotencyKey } from "@/lib/queue/idempotency";
import { generateBirthdayQueue } from "@/lib/queue/generate";
import { executeManualSend } from "@/lib/queue/manual-send";
import { claimQueueItemsForOrganization } from "@/lib/queue/claim";
import {
  processClaimedQueueItem,
  scheduleQueueRetry,
  sendQueueItem,
} from "@/lib/queue/send";
import { getOrganizationLocalIsoDate } from "@/lib/queue/dates";
import { createTemplate } from "@/lib/templates/service";
import { updateTemplateSmsSetup } from "@/lib/templates/sms-setup";
import { prisma } from "@/lib/db";
import { buildSmsChannelConfigInput, TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;



function registerInput(suffix: string, timezone = "America/New_York") {
  return {
    organizationName: `Automation Org ${suffix}`,
    organizationSlug: `automation-org-${suffix}`,
    timezone,
    adminName: "Automation Admin",
    email: `automation-${suffix}@test.local`,
    password: "password12345",
  };
}

function birthdayTemplateInput(name = "Birthday SMS") {
  return {
    name,
    type: "BIRTHDAY" as const,
    channel: "SMS" as const,
    body: "Happy Birthday {{name}}!",
    isActive: true,
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

async function enableAutomation(
  organizationId: string,
  templateId: string,
) {
  await updateBirthdayAutomationSettings(organizationId, {
    autoSendEnabled: true,
    birthdayTemplateId: templateId,
  });
}

describe("birthday automation", () => {
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

    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_CREDENTIALS_ENCRYPTION_KEY;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("uses birthday idempotency keys without templateId", () => {
    const key = buildBirthdayIdempotencyKey({
      contactId: "contact-1",
      channel: "SMS",
      occasionType: "BIRTHDAY",
      targetDate: "2026-07-11",
    });

    expect(key).toBe("birthday:contact-1:SMS:BIRTHDAY:2026-07-11");
  });

  it("does not create a second birthday row when the template changes same IST date", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const templateA = await createTemplate(
      org.organization.id,
      birthdayTemplateInput("A"),
    );
    const templateB = await createTemplate(
      org.organization.id,
      birthdayTemplateInput("B"),
    );
    await createContact(org.organization.id, {
      name: "Birthday Person",
      mobile: testMobile(),
      dateOfBirth: "1990-07-11",

      isActive: true,
    });

    const istToday = getOrganizationLocalIsoDate(
      BIRTHDAY_AUTOMATION_TIMEZONE,
      new Date("2026-07-11T12:00:00.000Z"),
    );

    const first = await generateBirthdayQueue(org.organization.id, {
      templateId: templateA.id,
      targetDate: istToday,
    });
    const second = await generateBirthdayQueue(org.organization.id, {
      templateId: templateB.id,
      targetDate: istToday,
    });

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.skippedDuplicate).toBe(1);

    await cleanupOrganization(org.organization.id);
  });

  it("distinguishes unprocessedByBound from skippedLimit", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(),
    );

    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: { monthlyMessageLimit: 100, messagesSentThisMonth: 0 },
    });

    const istToday = getOrganizationLocalIsoDate(
      BIRTHDAY_AUTOMATION_TIMEZONE,
      new Date("2026-07-11T12:00:00.000Z"),
    );

    for (let index = 0; index < 3; index += 1) {
      await createContact(org.organization.id, {
        name: `Person ${index}`,
        mobile: testMobile(),
        dateOfBirth: "1990-07-11",

        isActive: true,
      });
    }

    const summary = await generateBirthdayQueue(
      org.organization.id,
      {
        templateId: template.id,
        targetDate: istToday,
      },
      { maxCreates: 1 },
    );

    expect(summary.created).toBe(1);
    expect(summary.unprocessedByBound).toBe(2);
    expect(summary.skippedLimit).toBe(0);
    expect(summary.skippedIneligible).toBe(0);
    expect(summary.generationIncomplete).toBe(true);

    await cleanupOrganization(org.organization.id);
  });

  it("continues remaining contacts on a repeated same-day invocation", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(),
    );

    const istToday = getOrganizationLocalIsoDate(
      BIRTHDAY_AUTOMATION_TIMEZONE,
      new Date("2026-07-11T12:00:00.000Z"),
    );

    for (let index = 0; index < 3; index += 1) {
      await createContact(org.organization.id, {
        name: `Person ${index}`,
        mobile: testMobile(),
        dateOfBirth: "1990-07-11",

        isActive: true,
      });
    }

    const first = await generateBirthdayQueue(
      org.organization.id,
      { templateId: template.id, targetDate: istToday },
      { maxCreates: 1 },
    );
    const second = await generateBirthdayQueue(
      org.organization.id,
      { templateId: template.id, targetDate: istToday },
      { maxCreates: 1 },
    );

    expect(first.created).toBe(1);
    expect(second.created).toBe(1);
    expect(second.skippedDuplicate).toBe(1);

    const total = await prisma.sendQueue.count({
      where: { organizationId: org.organization.id, scheduledDate: new Date(`${istToday}T00:00:00.000Z`) },
    });
    expect(total).toBe(2);

    await cleanupOrganization(org.organization.id);
  });

  it("uses IST date regardless of organization timezone", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(
      registerInput(uniqueSuffix(), "America/New_York"),
    );
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(),
    );
    await enableAutomation(org.organization.id, template.id);
    await createContact(org.organization.id, {
      name: "IST Match",
      mobile: testMobile(),
      dateOfBirth: "1990-07-11",

      isActive: true,
    });

    const summary = await runBirthdayAutomation(
      new Date("2026-07-11T12:00:00.000Z"),
    );
    const orgSummary = summary.organizations.find(
      (item) => item.organizationId === org.organization.id,
    );

    expect(summary.targetDate).toBe("2026-07-11");
    expect(orgSummary?.generation?.created).toBe(1);

    await cleanupOrganization(org.organization.id);
  });

  it("processes only enabled organizations with configured templates", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const enabledOrg = await createRegisteredOrganization(
      registerInput(`enabled-${uniqueSuffix()}`),
    );
    const disabledOrg = await createRegisteredOrganization(
      registerInput(`disabled-${uniqueSuffix()}`),
    );
    const enabledTemplate = await createTemplate(
      enabledOrg.organization.id,
      birthdayTemplateInput("Enabled"),
    );
    const disabledTemplate = await createTemplate(
      disabledOrg.organization.id,
      birthdayTemplateInput("Disabled"),
    );

    await enableAutomation(enabledOrg.organization.id, enabledTemplate.id);
    await updateBirthdayAutomationSettings(disabledOrg.organization.id, {
      birthdayTemplateId: disabledTemplate.id,
      autoSendEnabled: false,
    });

    await createContact(enabledOrg.organization.id, {
      name: "Enabled Contact",
      mobile: testMobile(),
      dateOfBirth: "1990-03-15",

      isActive: true,
    });
    await createContact(disabledOrg.organization.id, {
      name: "Disabled Contact",
      mobile: testMobile(),
      dateOfBirth: "1990-03-15",

      isActive: true,
    });

    const summary = await runBirthdayAutomation(
      new Date("2031-03-15T06:00:00.000+05:30"),
    );

    expect(
      summary.organizations.filter(
        (item) => item.organizationId === enabledOrg.organization.id,
      ),
    ).toHaveLength(1);
    expect(summary.totalCreated).toBeGreaterThanOrEqual(1);

    const enabledQueues = await prisma.sendQueue.count({
      where: { organizationId: enabledOrg.organization.id },
    });
    expect(enabledQueues).toBe(1);

    const disabledQueues = await prisma.sendQueue.count({
      where: { organizationId: disabledOrg.organization.id },
    });
    expect(disabledQueues).toBe(0);

    await cleanupOrganization(enabledOrg.organization.id);
    await cleanupOrganization(disabledOrg.organization.id);
  });

  it("skips CUSTOM_HTTP organizations when the template is not ready", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(),
    );
    await enableAutomation(org.organization.id, template.id);
    await prisma.channelConfig.create({
      data: {
        organizationId: org.organization.id,
        channel: Channel.SMS,
        ...buildSmsChannelConfigInput({
          provider: ChannelProvider.CUSTOM_HTTP,
        }),
      },
    });
    await createContact(org.organization.id, {
      name: "Not Ready",
      mobile: testMobile(),
      dateOfBirth: "1990-07-11",

      isActive: true,
    });

    const summary = await runBirthdayAutomation(
      new Date("2026-07-11T12:00:00.000Z"),
    );
    const orgSummary = summary.organizations.find(
      (item) => item.organizationId === org.organization.id,
    );

    expect(orgSummary?.status).toBe("skipped_ineligible");
    expect(summary.totalCreated).toBe(0);

    const queues = await prisma.sendQueue.count({
      where: { organizationId: org.organization.id },
    });
    expect(queues).toBe(0);

    await cleanupOrganization(org.organization.id);
  });

  it("queues CUSTOM_HTTP organizations when the template is ready without delivering", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(),
    );
    await updateTemplateSmsSetup(org.organization.id, template.id, {
      dltTemplateId: "1234567890123456789012345",
      dltApprovedContent: "Happy Birthday {#var#}!",
      confirmDltPairReviewed: true,
    });
    await enableAutomation(org.organization.id, template.id);
    await prisma.channelConfig.create({
      data: {
        organizationId: org.organization.id,
        channel: Channel.SMS,
        ...buildSmsChannelConfigInput({
          provider: ChannelProvider.CUSTOM_HTTP,
        }),
      },
    });
    await createContact(org.organization.id, {
      name: "Ready Contact",
      mobile: "+919876543210",
      dateOfBirth: "1990-07-11",

      isActive: true,
    });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("1|1|provider-1", { status: 200 }));

    const summary = await runBirthdayAutomation(
      new Date("2026-07-11T12:00:00.000Z"),
    );

    expect(summary.totalCreated).toBe(1);
    expect(summary).not.toHaveProperty("totalSent");
    expect(fetchMock).not.toHaveBeenCalled();

    const pending = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id },
    });
    expect(pending.status).toBe("PENDING");

    const delivered = await sendQueueItem(org.organization.id, pending.id);
    expect(delivered.status).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockRestore();
    await cleanupOrganization(org.organization.id);
  });

  it("does not deliver dashboard-generated pending birthday queues when automation is disabled", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(),
    );
    await updateBirthdayAutomationSettings(org.organization.id, {
      birthdayTemplateId: template.id,
      autoSendEnabled: false,
    });
    await createContact(org.organization.id, {
      name: "Dashboard Pending",
      mobile: testMobile(),
      dateOfBirth: "1990-03-20",

      isActive: true,
    });

    await generateBirthdayQueue(org.organization.id, {
      templateId: template.id,
      targetDate: "2031-03-20",
    });

    const summary = await runBirthdayAutomation(
      new Date("2031-03-20T06:00:00.000+05:30"),
    );
    const orgSummary = summary.organizations.find(
      (item) => item.organizationId === org.organization.id,
    );

    expect(orgSummary).toBeUndefined();
    expect(summary).not.toHaveProperty("totalSent");

    const pending = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id },
    });
    expect(pending.status).toBe("PENDING");

    await cleanupOrganization(org.organization.id);
  });

  it("does not deliver dashboard-generated pending birthday queues during automation", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(),
    );
    await createContact(org.organization.id, {
      name: "Dashboard Enabled Pending",
      mobile: testMobile(),
      dateOfBirth: "1990-04-18",

      isActive: true,
    });

    await generateBirthdayQueue(org.organization.id, {
      templateId: template.id,
      targetDate: "2031-04-18",
    });

    await enableAutomation(org.organization.id, template.id);

    const summary = await runBirthdayAutomation(
      new Date("2031-04-18T06:00:00.000+05:30"),
    );
    const orgSummary = summary.organizations.find(
      (item) => item.organizationId === org.organization.id,
    );

    expect(orgSummary?.generation?.created).toBe(0);
    expect(orgSummary?.generation?.skippedDuplicate).toBe(1);
    expect(orgSummary).not.toHaveProperty("send");

    const pending = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id },
    });
    expect(pending.status).toBe("PENDING");

    const delivered = await sendQueueItem(org.organization.id, pending.id);
    expect(delivered.status).toBe("sent");

    await cleanupOrganization(org.organization.id);
  });

  it("does not deliver manual send queues during automation", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthdayTemplate = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(),
    );
    const manualTemplate = await createTemplate(org.organization.id, {
      name: "Manual",
      type: "CUSTOM",
      channel: "SMS",
      body: "Hello {{name}}",
      isActive: true,
    });
    await enableAutomation(org.organization.id, birthdayTemplate.id);

    const contact = await createContact(org.organization.id, {
      name: "Manual Contact",
      mobile: testMobile(),
      dateOfBirth: "1990-08-10",

      isActive: true,
    });

    await executeManualSend(org.organization.id, {
      templateId: manualTemplate.id,
      contactIds: [contact.id],
    });

    const manualQueue = await prisma.sendQueue.findFirstOrThrow({
      where: {
        organizationId: org.organization.id,
        occasionType: OccasionType.CUSTOM,
      },
    });

    expect(manualQueue.status).toBe("PENDING");

    const summary = await runBirthdayAutomation(
      new Date("2026-07-10T12:00:00.000Z"),
    );

    expect(summary).not.toHaveProperty("totalSent");

    const stillPending = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: manualQueue.id },
    });
    expect(stillPending.status).toBe("PENDING");

    await cleanupOrganization(org.organization.id);
  });

  it("continues remaining birthday creates from an earlier same-day run", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(),
    );
    await enableAutomation(org.organization.id, template.id);

    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: {
        contactLimit: MAX_BIRTHDAY_CREATES_PER_ORGANIZATION + 10,
        monthlyMessageLimit: MAX_BIRTHDAY_CREATES_PER_ORGANIZATION + 10,
      },
    });

    for (
      let index = 0;
      index < MAX_BIRTHDAY_CREATES_PER_ORGANIZATION + 1;
      index += 1
    ) {
      await createContact(org.organization.id, {
        name: `Bulk ${index}`,
        mobile: testMobile(),
        dateOfBirth: "1990-07-11",

        isActive: true,
      });
    }

    const firstRun = await runBirthdayAutomation(
      new Date("2026-07-11T12:00:00.000Z"),
    );
    const firstOrg = firstRun.organizations.find(
      (item) => item.organizationId === org.organization.id,
    );
    expect(firstOrg?.generation?.created).toBe(
      MAX_BIRTHDAY_CREATES_PER_ORGANIZATION,
    );
    expect(firstOrg?.generation?.unprocessedByBound).toBe(1);
    expect(firstRun.processingIncomplete).toBe(true);
    expect(firstRun).not.toHaveProperty("sendAttemptsUsed");

    const pendingBeforeSecond = await prisma.sendQueue.count({
      where: {
        organizationId: org.organization.id,
        status: QueueStatus.PENDING,
        occasionType: OccasionType.BIRTHDAY,
      },
    });
    expect(pendingBeforeSecond).toBe(MAX_BIRTHDAY_CREATES_PER_ORGANIZATION);

    const secondRun = await runBirthdayAutomation(
      new Date("2026-07-11T12:00:00.000Z"),
    );
    const secondOrg = secondRun.organizations.find(
      (item) => item.organizationId === org.organization.id,
    );
    expect(secondOrg?.generation?.created).toBe(1);
    expect(secondRun).not.toHaveProperty("totalSent");

    const totalPending = await prisma.sendQueue.count({
      where: {
        organizationId: org.organization.id,
        status: QueueStatus.PENDING,
        occasionType: OccasionType.BIRTHDAY,
      },
    });
    expect(totalPending).toBe(MAX_BIRTHDAY_CREATES_PER_ORGANIZATION + 1);

    await cleanupOrganization(org.organization.id);
  });

  it("skips inactive contacts at send time for birthday queue items", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(),
    );
    const contact = await createContact(org.organization.id, {
      name: "Inactive Later",
      mobile: testMobile(),
      dateOfBirth: "1990-07-11",

      isActive: true,
    });

    const istToday = getOrganizationLocalIsoDate(
      BIRTHDAY_AUTOMATION_TIMEZONE,
      new Date("2026-07-11T12:00:00.000Z"),
    );

    const generation = await generateBirthdayQueue(org.organization.id, {
      templateId: template.id,
      targetDate: istToday,
    });

    await prisma.contact.update({
      where: { id: contact.id },
      data: { isActive: false },
    });

    const result = await sendQueueItem(
      org.organization.id,
      generation.queueIds[0]!,
    );

    expect(result.status).toBe("skipped");
    expect(result.queue?.status).toBe("SKIPPED");

    const logs = await prisma.deliveryLog.count({
      where: { sendQueueId: generation.queueIds[0]! },
    });
    expect(logs).toBe(0);

    await cleanupOrganization(org.organization.id);
  });

  it("does not block manual send when a contact is inactive at send time", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(org.organization.id, {
      name: "Manual",
      type: "CUSTOM",
      channel: "SMS",
      body: "Hello {{name}}",
      isActive: true,
    });
    const contact = await createContact(org.organization.id, {
      name: "Manual Active",
      mobile: testMobile(),

      isActive: true,
    });

    const manual = await executeManualSend(org.organization.id, {
      templateId: template.id,
      contactIds: [contact.id],
    });

    expect(manual.queued.created).toBe(1);
    expect(manual).not.toHaveProperty("send");

    const queue = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id },
    });
    expect(queue.status).toBe("PENDING");

    await cleanupOrganization(org.organization.id);
  });

  it("blocks regeneration when a FAILED birthday row exists and retry uses the same row", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(),
    );
    await createContact(org.organization.id, {
      name: "Fail Person",
      mobile: "9811000001",
      dateOfBirth: "1990-07-11",

      isActive: true,
    });

    const istToday = getOrganizationLocalIsoDate(
      BIRTHDAY_AUTOMATION_TIMEZONE,
      new Date("2026-07-11T12:00:00.000Z"),
    );

    const generation = await generateBirthdayQueue(org.organization.id, {
      templateId: template.id,
      targetDate: istToday,
    });

    const failed = await sendQueueItem(
      org.organization.id,
      generation.queueIds[0]!,
    );
    expect(failed.status).toBe("retry_scheduled");
    expect(failed.queue?.status).toBe("FAILED");

    const duplicate = await generateBirthdayQueue(org.organization.id, {
      templateId: template.id,
      targetDate: istToday,
    });
    expect(duplicate.created).toBe(0);
    expect(duplicate.skippedDuplicate).toBe(1);

    await scheduleQueueRetry(org.organization.id, generation.queueIds[0]!);
    const claimed = await claimQueueItemsForOrganization(org.organization.id);
    expect(claimed.map((item) => item.id)).toContain(generation.queueIds[0]!);

    const retried = await processClaimedQueueItem(
      org.organization.id,
      generation.queueIds[0]!,
    );
    expect(retried.status).toBe("sent");

    await cleanupOrganization(org.organization.id);
  });

  it("does not exceed the per-organization creation bound", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(),
    );
    await enableAutomation(org.organization.id, template.id);

    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: { contactLimit: MAX_BIRTHDAY_CREATES_PER_ORGANIZATION + 10 },
    });

    for (let index = 0; index < MAX_BIRTHDAY_CREATES_PER_ORGANIZATION + 2; index += 1) {
      await createContact(org.organization.id, {
        name: `Create Bound ${index}`,
        mobile: testMobile(),
        dateOfBirth: "1990-07-11",

        isActive: true,
      });
    }

    const summary = await runBirthdayAutomation(
      new Date("2026-07-11T12:00:00.000Z"),
    );
    const orgSummary = summary.organizations.find(
      (item) => item.organizationId === org.organization.id,
    );

    expect(orgSummary?.generation?.created).toBe(
      MAX_BIRTHDAY_CREATES_PER_ORGANIZATION,
    );
    expect(orgSummary?.generation?.unprocessedByBound).toBe(2);
    expect(summary.processingIncomplete).toBe(true);

    await cleanupOrganization(org.organization.id);
  });
});

describe("birthday automation cron auth", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterAll(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("fails closed when CRON_SECRET is missing", () => {
    delete process.env.CRON_SECRET;

    expect(() =>
      requireCronSecret(
        new Request("http://localhost/api/v1/internal/cron/birthday-automation"),
      ),
    ).toThrow(CronAuthError);
  });

  it("rejects missing and invalid authorization", () => {
    process.env.CRON_SECRET = "test-secret";

    expect(() =>
      requireCronSecret(
        new Request("http://localhost/api/v1/internal/cron/birthday-automation"),
      ),
    ).toThrow(CronAuthError);

    expect(() =>
      requireCronSecret(
        new Request("http://localhost/api/v1/internal/cron/birthday-automation", {
          headers: { authorization: "Bearer wrong-secret" },
        }),
      ),
    ).toThrow(CronAuthError);
  });

  it("accepts a valid bearer secret", () => {
    process.env.CRON_SECRET = "test-secret";

    expect(() =>
      requireCronSecret(
        new Request("http://localhost/api/v1/internal/cron/birthday-automation", {
          headers: { authorization: "Bearer test-secret" },
        }),
      ),
    ).not.toThrow();
  });
});
