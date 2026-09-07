import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DeliveryStatus, QueueStatus } from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import {
  AMBIGUOUS_PROVIDER_OUTCOME,
  QUEUE_LEASE_DURATION_MS,
} from "@/lib/queue/constants";
import { recoverExpiredLeases } from "@/lib/queue/recover";
import { scheduleQueueRetry } from "@/lib/queue/send";
import { QueueInvalidStateError } from "@/lib/queue/errors";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;


function registerInput(suffix: string) {
  return {
    organizationName: `Lease Org ${suffix}`,
    organizationSlug: `lease-org-${suffix}`,
    timezone: "UTC",
    adminName: "Lease Admin",
    email: `lease-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

describe("lease recovery and ambiguous outcomes", () => {
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

  it("recovers expired pre-provider leases without incrementing attempts", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(org.organization.id, {
      name: "SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Hello {{name}}!",
      isActive: true,
    });
    const contact = await createContact(org.organization.id, {
      name: "Lease Person",
      mobile: testMobile(),

      isActive: true,
    });

    const expired = new Date(Date.now() - QUEUE_LEASE_DURATION_MS - 1000);
    const queue = await prisma.sendQueue.create({
      data: {
        organizationId: org.organization.id,
        contactId: contact.id,
        recipientName: contact.name,
        recipientMobile: contact.mobile,
        recipientEmail: contact.email,
        templateId: template.id,
        channel: "SMS",
        occasionId: birthday.id,
        scheduledDate: new Date("2026-07-12"),
        renderedBody: "Hello",
        status: QueueStatus.SENDING,
        attemptCount: 0,
        claimedAt: expired,
        leaseExpiresAt: expired,
        providerAttemptStartedAt: null,
        idempotencyKey: `pre-${Date.now()}`,
      },
    });

    const summary = await recoverExpiredLeases();
    expect(summary.recoveredBeforeSubmission).toBeGreaterThanOrEqual(1);

    const updated = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(updated.status).toBe(QueueStatus.PENDING);
    expect(updated.attemptCount).toBe(0);
    expect(updated.claimedAt).toBeNull();
    expect(updated.leaseExpiresAt).toBeNull();

    const logs = await prisma.deliveryLog.count({
      where: { sendQueueId: queue.id },
    });
    expect(logs).toBe(0);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("finalizes expired post-start leases as ambiguous exactly once", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(org.organization.id, {
      name: "SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Hello {{name}}!",
      isActive: true,
    });
    const contact = await createContact(org.organization.id, {
      name: "Ambiguous Person",
      mobile: testMobile(),

      isActive: true,
    });

    const expired = new Date(Date.now() - 1000);
    const queue = await prisma.sendQueue.create({
      data: {
        organizationId: org.organization.id,
        contactId: contact.id,
        recipientName: contact.name,
        recipientMobile: contact.mobile,
        recipientEmail: contact.email,
        templateId: template.id,
        channel: "SMS",
        occasionId: birthday.id,
        scheduledDate: new Date("2026-07-12"),
        renderedBody: "Hello",
        status: QueueStatus.SENDING,
        attemptCount: 0,
        claimedAt: expired,
        leaseExpiresAt: expired,
        providerAttemptStartedAt: expired,
        idempotencyKey: `post-${Date.now()}`,
      },
    });

    const [first, second] = await Promise.all([
      recoverExpiredLeases(),
      recoverExpiredLeases(),
    ]);

    expect(
      first.finalizedAmbiguous + second.finalizedAmbiguous,
    ).toBe(1);

    const updated = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(updated.status).toBe(QueueStatus.FAILED);
    expect(updated.lastErrorCode).toBe(AMBIGUOUS_PROVIDER_OUTCOME);
    expect(updated.attemptCount).toBe(1);
    expect(updated.nextAttemptAt).toBeNull();

    const logs = await prisma.deliveryLog.findMany({
      where: { sendQueueId: queue.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe(DeliveryStatus.FAILED);
    expect(logs[0]?.errorCode).toBe(AMBIGUOUS_PROVIDER_OUTCOME);

    await expect(
      scheduleQueueRetry(org.organization.id, queue.id, {}),
    ).rejects.toBeInstanceOf(QueueInvalidStateError);

    const scheduled = await scheduleQueueRetry(org.organization.id, queue.id, {
      confirmAmbiguousRetry: true,
    });
    expect(scheduled.status).toBe("scheduled");
    expect(scheduled.warning).toContain("duplicate");

    const after = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(after.lastErrorCode).toBeNull();
    expect(after.nextAttemptAt).not.toBeNull();

    const usage = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: org.organization.id },
    });
    // No usage reservation occurs during recovery/retry scheduling.
    expect(usage.messagesSentThisMonth).toBe(0);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });
});
