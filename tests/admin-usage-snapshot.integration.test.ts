import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Channel, QueueStatus } from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { getPlatformUsageSnapshot } from "@/lib/admin/org-ops";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { MAX_SEND_ATTEMPTS } from "@/lib/queue/constants";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function randomMobile(): string {
  return `9${Math.floor(Math.random() * 1e9).toString().padStart(9, "0")}`;
}

async function seedOrg() {
  const suffix = uniqueSuffix();
  const org = await createRegisteredOrganization({
    organizationName: `Usage Org ${suffix}`,
    organizationSlug: `usage-org-${suffix}`,
    timezone: "Asia/Kolkata",
    adminName: "Owner",
    email: `usage-${suffix}@test.local`,
    password: "password12345",
  });
  const organizationId = org.organization.id;
  const birthday = await ensureSystemBirthdayOccasion(organizationId);
  const template = await createTemplate(organizationId, {
    name: "SMS",
    occasionId: birthday.id,
    channel: "SMS",
    body: "Hello {{name}}!",
    isActive: true,
  });
  return { organizationId, templateId: template.id, occasionId: birthday.id };
}

async function createFailedQueueRow(
  organizationId: string,
  templateId: string,
  occasionId: string,
  overrides: { attemptCount: number; lastErrorCode: string | null },
) {
  const contact = await createContact(organizationId, {
    name: "Failed Contact",
    mobile: randomMobile(),
    isActive: true,
  });
  return prisma.sendQueue.create({
    data: {
      organizationId,
      contactId: contact.id,
      recipientName: contact.name,
      recipientMobile: contact.mobile,
      templateId,
      channel: Channel.SMS,
      occasionId,
      scheduledDate: new Date("2026-07-10"),
      renderedBody: "Hello",
      status: QueueStatus.FAILED,
      idempotencyKey: `usage-snapshot:${uniqueSuffix()}`,
      attemptCount: overrides.attemptCount,
      lastErrorCode: overrides.lastErrorCode,
    },
  });
}

describe("admin usage snapshot: queue-failed split and near-limit totals", () => {
  beforeAll(async () => {
    if (!databaseUrl) return;
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

  it("splits FAILED queue rows into will-retry vs needs-attention", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();
    const { organizationId, templateId, occasionId } = await seedOrg();

    const before = await getPlatformUsageSnapshot();

    // Under the attempt cap with a recognized transient error: retries on its own.
    await createFailedQueueRow(organizationId, templateId, occasionId, {
      attemptCount: 1,
      lastErrorCode: "PROVIDER_ERROR",
    });
    // Under the attempt cap with no error code yet: also still eligible.
    await createFailedQueueRow(organizationId, templateId, occasionId, {
      attemptCount: 0,
      lastErrorCode: null,
    });
    // At the attempt cap: exhausted, needs a human.
    await createFailedQueueRow(organizationId, templateId, occasionId, {
      attemptCount: MAX_SEND_ATTEMPTS,
      lastErrorCode: "PROVIDER_ERROR",
    });
    // A permanent error code: never auto-retried regardless of attempts.
    await createFailedQueueRow(organizationId, templateId, occasionId, {
      attemptCount: 0,
      lastErrorCode: "INVALID_CREDENTIALS",
    });

    const after = await getPlatformUsageSnapshot();

    expect(after.queueFailedRetryable - before.queueFailedRetryable).toBe(2);
    expect(after.queueFailedStuck - before.queueFailedStuck).toBe(2);

    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("reports the real total near a limit even when more than 10 clients qualify", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const created: string[] = [];
    for (let i = 0; i < 11; i += 1) {
      const suffix = uniqueSuffix();
      const org = await createRegisteredOrganization({
        organizationName: `Near Limit ${suffix}`,
        organizationSlug: `near-limit-${suffix}`,
        timezone: "Asia/Kolkata",
        adminName: "Owner",
        email: `near-limit-${suffix}@test.local`,
        password: "password12345",
      });
      await prisma.subscription.update({
        where: { organizationId: org.organization.id },
        data: { contactLimit: 10 },
      });
      for (let c = 0; c < 9; c += 1) {
        await createContact(org.organization.id, {
          name: `Contact ${c}`,
          mobile: randomMobile(),
          isActive: true,
        });
      }
      created.push(org.organization.id);
    }

    const usage = await getPlatformUsageSnapshot();

    expect(usage.nearContactLimitTotal).toBeGreaterThanOrEqual(11);
    expect(usage.nearContactLimit.length).toBe(10);

    for (const id of created) {
      await prisma.organization.delete({ where: { id } });
    }
  });
});
