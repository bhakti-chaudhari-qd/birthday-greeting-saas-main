import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChannelProvider, QueueStatus } from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { upsertSmsChannelConfig } from "@/lib/channel-config/service";
import { createContact } from "@/lib/contacts/service";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { WORKER_TENANT_CONCURRENCY } from "@/lib/queue/constants";
import { drainMessageWorker, runMessageWorker } from "@/lib/queue/worker";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

const ROWS_PER_TENANT = 3;

async function seedTenant(suffix: string, rows: number = ROWS_PER_TENANT) {
  const registered = await createRegisteredOrganization({
    organizationName: `Parallel Org ${suffix}`,
    organizationSlug: `parallel-org-${suffix}`,
    timezone: "Asia/Kolkata",
    adminName: "Parallel Admin",
    email: `parallel-admin-${suffix}@test.local`,
    password: "password12345",
  });
  const organizationId = registered.organization.id;

  await upsertSmsChannelConfig(organizationId, {
    provider: ChannelProvider.TEST,
    isActive: true,
  });

  const birthday = await ensureSystemBirthdayOccasion(organizationId);
  const template = await createTemplate(organizationId, {
    name: "SMS",
    occasionId: birthday.id,
    channel: "SMS",
    body: "Hello {{name}}!",
    isActive: true,
  });

  for (let i = 0; i < rows; i += 1) {
    const contact = await createContact(organizationId, {
      name: `P ${i}`,
      mobile: testMobile(),
      isActive: true,
    });
    await prisma.sendQueue.create({
      data: {
        organizationId,
        contactId: contact.id,
        recipientName: contact.name,
        recipientMobile: contact.mobile,
        recipientEmail: contact.email,
        templateId: template.id,
        channel: "SMS",
        occasionId: birthday.id,
        scheduledDate: new Date("2026-07-12"),
        renderedBody: `Hello ${contact.name}`,
        status: QueueStatus.PENDING,
        idempotencyKey: `parallel-${suffix}-${i}`,
      },
    });
  }

  return organizationId;
}

describe("message worker with several tenants at once", () => {
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

  it("sends every tenant's rows when there are more tenants than parallel slots", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const tenantCount = WORKER_TENANT_CONCURRENCY * 2 + 1;
    const organizationIds: string[] = [];

    try {
      for (let i = 0; i < tenantCount; i += 1) {
        organizationIds.push(await seedTenant(`${uniqueSuffix()}-${i}`));
      }

      // A send cap below the tenant count forces tenants to share send slots.
      const summary = await runMessageWorker({ globalSendConcurrency: 2 });

      expect(summary.tenantsProcessed).toBeGreaterThanOrEqual(tenantCount);

      const sentByTenant = await prisma.sendQueue.groupBy({
        by: ["organizationId", "status"],
        where: { organizationId: { in: organizationIds } },
        _count: { _all: true },
      });

      expect(sentByTenant).toHaveLength(tenantCount);
      for (const group of sentByTenant) {
        expect(group.status).toBe(QueueStatus.SENT);
        expect(group._count._all).toBe(ROWS_PER_TENANT);
      }

      // One delivery log per row: nothing was sent twice.
      const logs = await prisma.deliveryLog.count({
        where: { organizationId: { in: organizationIds } },
      });
      expect(logs).toBe(tenantCount * ROWS_PER_TENANT);
    } finally {
      await prisma.organization.deleteMany({
        where: { id: { in: organizationIds } },
      });
    }
  });

  it("keeps running passes until a tenant's backlog is sent", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const rows = 5;
    const organizationId = await seedTenant(uniqueSuffix(), rows);

    try {
      // 2 rows per pass: one pass alone would leave 3 behind.
      const summary = await drainMessageWorker({ claimBatchSizePerTenant: 2 });

      expect(summary.passes).toBeGreaterThanOrEqual(3);
      expect(
        await prisma.sendQueue.count({
          where: { organizationId, status: QueueStatus.SENT },
        }),
      ).toBe(rows);
    } finally {
      await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
  });

  it("stops after one pass when the time budget is already spent", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const rows = 5;
    const organizationId = await seedTenant(uniqueSuffix(), rows);

    try {
      const summary = await drainMessageWorker({
        claimBatchSizePerTenant: 2,
        timeBudgetMs: 0,
      });

      expect(summary.passes).toBe(1);
      expect(summary.processingIncomplete).toBe(true);
      expect(
        await prisma.sendQueue.count({
          where: { organizationId, status: QueueStatus.SENT },
        }),
      ).toBe(2);
    } finally {
      await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
  });
});
