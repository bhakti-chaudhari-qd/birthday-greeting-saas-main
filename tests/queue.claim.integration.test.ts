import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { QueueStatus } from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import {
  AMBIGUOUS_PROVIDER_OUTCOME,
  MAX_SEND_ATTEMPTS,
  WORKER_CLAIM_BATCH_SIZE_PER_TENANT,
} from "@/lib/queue/constants";
import {
  claimQueueItemsForOrganization,
  listOrganizationsWithClaimableWork,
} from "@/lib/queue/claim";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;


function registerInput(suffix: string) {
  return {
    organizationName: `Claim Org ${suffix}`,
    organizationSlug: `claim-org-${suffix}`,
    timezone: "Asia/Kolkata",
    adminName: "Claim Admin",
    email: `claim-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

async function seedPendingQueues(
  organizationId: string,
  templateId: string,
  occasionId: string,
  count: number,
  scheduledDate = new Date("2026-07-12"),
) {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const contact = await createContact(organizationId, {
      name: `Claim Contact ${i}`,
      mobile: testMobile(),

      isActive: true,
    });
    const queue = await prisma.sendQueue.create({
      data: {
        organizationId,
        contactId: contact.id,
        recipientName: contact.name,
        recipientMobile: contact.mobile,
        recipientEmail: contact.email,
        templateId,
        channel: "SMS",
        occasionId,
        scheduledDate,
        renderedBody: `Hello ${contact.name}`,
        status: QueueStatus.PENDING,
        idempotencyKey: `claim-test:${organizationId}:${i}:${Date.now()}`,
      },
    });
    ids.push(queue.id);
  }
  return ids;
}

describe("queue claiming", () => {
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

  it("claims atomically without duplicate rows across concurrent workers", async ({
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
    await seedPendingQueues(org.organization.id, template.id, birthday.id, 10);

    const [a, b] = await Promise.all([
      claimQueueItemsForOrganization(org.organization.id, { limit: 10 }),
      claimQueueItemsForOrganization(org.organization.id, { limit: 10 }),
    ]);

    const ids = [...a, ...b].map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(10);

    const claimed = await prisma.sendQueue.findMany({
      where: { id: { in: ids } },
    });
    for (const row of claimed) {
      expect(row.status).toBe(QueueStatus.SENDING);
      expect(row.claimedAt).not.toBeNull();
      expect(row.leaseExpiresAt).not.toBeNull();
      expect(row.providerAttemptStartedAt).toBeNull();
    }

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("caps claims at 25 per tenant and still lists later tenants", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const large = await createRegisteredOrganization(registerInput(`${suffix}-a`));
    const small = await createRegisteredOrganization(registerInput(`${suffix}-b`));
    const birthdayLarge = await ensureSystemBirthdayOccasion(large.organization.id);
    const birthdaySmall = await ensureSystemBirthdayOccasion(small.organization.id);

    const largeTemplate = await createTemplate(large.organization.id, {
      name: "SMS",
      occasionId: birthdayLarge.id,
      channel: "SMS",
      body: "Hello {{name}}!",
      isActive: true,
    });
    const smallTemplate = await createTemplate(small.organization.id, {
      name: "SMS",
      occasionId: birthdaySmall.id,
      channel: "SMS",
      body: "Hello {{name}}!",
      isActive: true,
    });

    await seedPendingQueues(
      large.organization.id,
      largeTemplate.id,
      birthdayLarge.id,
      WORKER_CLAIM_BATCH_SIZE_PER_TENANT + 5,
    );
    await seedPendingQueues(small.organization.id, smallTemplate.id, birthdaySmall.id, 3);

    const orgs = await listOrganizationsWithClaimableWork();
    expect(orgs).toContain(large.organization.id);
    expect(orgs).toContain(small.organization.id);

    const largeClaim = await claimQueueItemsForOrganization(
      large.organization.id,
    );
    expect(largeClaim.length).toBe(WORKER_CLAIM_BATCH_SIZE_PER_TENANT);

    const smallClaim = await claimQueueItemsForOrganization(
      small.organization.id,
    );
    expect(smallClaim.length).toBe(3);

    await prisma.organization.delete({ where: { id: large.organization.id } });
    await prisma.organization.delete({ where: { id: small.organization.id } });
  });

  it("does not claim ambiguous, permanent, max-attempt, unknown, or future retry rows", async ({
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
      name: "Blocked",
      mobile: testMobile(),

      isActive: true,
    });

    const base = {
      organizationId: org.organization.id,
      contactId: contact.id,
      recipientName: contact.name,
      recipientMobile: contact.mobile,
      recipientEmail: contact.email,
      templateId: template.id,
      channel: "SMS" as const,
      occasionId: birthday.id,
      scheduledDate: new Date("2026-07-12"),
      renderedBody: "Hello",
    };

    const blocked = await Promise.all([
      prisma.sendQueue.create({
        data: {
          ...base,
          status: QueueStatus.FAILED,
          idempotencyKey: `amb-${Date.now()}-1`,
          lastErrorCode: AMBIGUOUS_PROVIDER_OUTCOME,
          attemptCount: 1,
        },
      }),
      prisma.sendQueue.create({
        data: {
          ...base,
          status: QueueStatus.FAILED,
          idempotencyKey: `perm-${Date.now()}-2`,
          lastErrorCode: "TEMPLATE_NOT_READY",
          attemptCount: 1,
        },
      }),
      prisma.sendQueue.create({
        data: {
          ...base,
          status: QueueStatus.FAILED,
          idempotencyKey: `config-${Date.now()}-3`,
          lastErrorCode: "INVALID_PROVIDER_CONFIG",
          attemptCount: 0,
          nextAttemptAt: null,
        },
      }),
      prisma.sendQueue.create({
        data: {
          ...base,
          status: QueueStatus.FAILED,
          idempotencyKey: `unknown-${Date.now()}-4`,
          lastErrorCode: "WEIRD_UNKNOWN_CODE",
          attemptCount: 1,
          nextAttemptAt: new Date(0),
        },
      }),
      prisma.sendQueue.create({
        data: {
          ...base,
          status: QueueStatus.FAILED,
          idempotencyKey: `max-${Date.now()}-5`,
          attemptCount: MAX_SEND_ATTEMPTS,
          lastErrorCode: "TEST_PROVIDER_FAIL",
        },
      }),
      prisma.sendQueue.create({
        data: {
          ...base,
          status: QueueStatus.FAILED,
          idempotencyKey: `future-${Date.now()}-6`,
          attemptCount: 1,
          lastErrorCode: "TEST_PROVIDER_FAIL",
          nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      }),
      prisma.sendQueue.create({
        data: {
          ...base,
          status: QueueStatus.FAILED,
          idempotencyKey: `http429-${Date.now()}-7`,
          lastErrorCode: "PROVIDER_HTTP_429",
          attemptCount: 1,
          nextAttemptAt: new Date(0),
        },
      }),
    ]);

    expect(blocked).toHaveLength(7);

    const claimed = await claimQueueItemsForOrganization(org.organization.id);
    expect(claimed).toEqual([]);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("does not claim PENDING rows held until a future nextAttemptAt", async ({
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
      name: "Held",
      mobile: testMobile(),

      isActive: true,
    });

    const held = await prisma.sendQueue.create({
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
        status: QueueStatus.PENDING,
        idempotencyKey: `birthday:held:${Date.now()}`,
        nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000),
        lastErrorCode: "BEFORE_AUTOMATION_SEND_TIME",
      },
    });
    const ready = await prisma.sendQueue.create({
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
        renderedBody: "Hello ready",
        status: QueueStatus.PENDING,
        idempotencyKey: `birthday:ready:${Date.now()}`,
        nextAttemptAt: null,
      },
    });

    const orgs = await listOrganizationsWithClaimableWork();
    expect(orgs).toContain(org.organization.id);

    const claimed = await claimQueueItemsForOrganization(org.organization.id);
    expect(claimed.map((row) => row.id)).toEqual([ready.id]);

    const heldRow = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: held.id },
    });
    expect(heldRow.status).toBe(QueueStatus.PENDING);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("claims due retryable FAILED rows", async ({ skip }) => {
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
      name: "Retryable",
      mobile: testMobile(),

      isActive: true,
    });

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
        status: QueueStatus.FAILED,
        attemptCount: 1,
        lastErrorCode: "TEST_PROVIDER_FAIL",
        nextAttemptAt: new Date(0),
        idempotencyKey: `due-${Date.now()}`,
      },
    });

    const claimed = await claimQueueItemsForOrganization(org.organization.id);
    expect(claimed.map((row) => row.id)).toEqual([queue.id]);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });
});
