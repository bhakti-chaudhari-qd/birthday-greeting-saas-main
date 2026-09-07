import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChannelProvider, QueueStatus } from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { upsertSmsChannelConfig } from "@/lib/channel-config/service";
import { createContact } from "@/lib/contacts/service";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import {
  WORKER_CLAIM_BATCH_SIZE_PER_TENANT,
  WORKER_GLOBAL_SEND_CONCURRENCY,
} from "@/lib/queue/constants";
import { runMessageWorker } from "@/lib/queue/worker";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { POST as drainPost } from "@/app/api/v1/internal/worker/drain/route";
import { uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;
const previousCronSecret = process.env.CRON_SECRET;


function registerInput(suffix: string) {
  return {
    organizationName: `Worker Org ${suffix}`,
    organizationSlug: `worker-org-${suffix}`,
    timezone: "Asia/Kolkata",
    adminName: "Worker Admin",
    email: `worker-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

async function seedPending(
  organizationId: string,
  templateId: string,
  occasionId: string,
  count: number,
) {
  for (let i = 0; i < count; i += 1) {
    const contact = await createContact(organizationId, {
      name: `W ${i}`,
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
        templateId,
        channel: "SMS",
        occasionId,
        scheduledDate: new Date("2026-07-12"),
        renderedBody: `Hello ${contact.name}`,
        status: QueueStatus.PENDING,
        idempotencyKey: `worker:${organizationId}:${i}:${Date.now()}:${Math.random()}`,
      },
    });
  }
}

describe("message worker", () => {
  beforeAll(async () => {
    process.env.CRON_SECRET = "test-cron-secret-worker-drain";
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
    if (previousCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousCronSecret;
    }
    await prisma.$disconnect();
  });

  it("processes uneven tenants fairly and returns a safe summary", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const previousMinute = process.env.SEND_VELOCITY_PER_MINUTE;
    const previousDay = process.env.SEND_VELOCITY_PER_DAY;
    process.env.SEND_VELOCITY_PER_MINUTE = "500";
    process.env.SEND_VELOCITY_PER_DAY = "50000";

    const suffix = uniqueSuffix();
    const large = await createRegisteredOrganization(registerInput(`${suffix}-l`));
    const small = await createRegisteredOrganization(registerInput(`${suffix}-s`));

    await upsertSmsChannelConfig(large.organization.id, {
      provider: ChannelProvider.TEST,
      isActive: true,
    });
    await upsertSmsChannelConfig(small.organization.id, {
      provider: ChannelProvider.TEST,
      isActive: true,
    });

    await prisma.subscription.updateMany({
      where: {
        organizationId: {
          in: [large.organization.id, small.organization.id],
        },
      },
      data: {
        contactLimit: 1_000,
        monthlyMessageLimit: 100_000,
      },
    });

    try {
    const largeBirthday = await ensureSystemBirthdayOccasion(large.organization.id);
    const smallBirthday = await ensureSystemBirthdayOccasion(small.organization.id);
    const largeTemplate = await createTemplate(large.organization.id, {
      name: "SMS",
      occasionId: largeBirthday.id,
      channel: "SMS",
      body: "Hello {{name}}!",
      isActive: true,
    });
    const smallTemplate = await createTemplate(small.organization.id, {
      name: "SMS",
      occasionId: smallBirthday.id,
      channel: "SMS",
      body: "Hello {{name}}!",
      isActive: true,
    });

    await seedPending(
      large.organization.id,
      largeTemplate.id,
      largeBirthday.id,
      WORKER_CLAIM_BATCH_SIZE_PER_TENANT + 2,
    );
    await seedPending(small.organization.id, smallTemplate.id, smallBirthday.id, 2);

    const summary = await runMessageWorker({
      random: () => 0.5,
    });

    expect(summary.tenantsProcessed).toBeGreaterThanOrEqual(2);
    expect(summary.queuesClaimed).toBeGreaterThanOrEqual(
      WORKER_CLAIM_BATCH_SIZE_PER_TENANT + 2,
    );
    expect(summary.sent).toBeGreaterThanOrEqual(
      WORKER_CLAIM_BATCH_SIZE_PER_TENANT + 2,
    );
    expect(summary.processingIncomplete).toBe(true);
    expect(WORKER_GLOBAL_SEND_CONCURRENCY).toBe(25);

    const summaryJson = JSON.stringify(summary);
    expect(summaryJson).not.toMatch(/\+91/);
    expect(summaryJson).not.toMatch(/Hello /);
    expect(summaryJson).not.toMatch(/password|secret|credential/i);

    const smallSent = await prisma.sendQueue.count({
      where: {
        organizationId: small.organization.id,
        status: QueueStatus.SENT,
      },
    });
    expect(smallSent).toBe(2);

    await prisma.organization.delete({ where: { id: large.organization.id } });
    await prisma.organization.delete({ where: { id: small.organization.id } });
    } finally {
      if (previousMinute === undefined) {
        delete process.env.SEND_VELOCITY_PER_MINUTE;
      } else {
        process.env.SEND_VELOCITY_PER_MINUTE = previousMinute;
      }
      if (previousDay === undefined) {
        delete process.env.SEND_VELOCITY_PER_DAY;
      } else {
        process.env.SEND_VELOCITY_PER_DAY = previousDay;
      }
    }
  });

  it("protects the worker drain endpoint with CRON_SECRET", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const missing = await drainPost(
      new Request("http://localhost/api/v1/internal/worker/drain", {
        method: "POST",
      }),
    );
    expect(missing.status).toBe(401);

    const wrong = await drainPost(
      new Request("http://localhost/api/v1/internal/worker/drain", {
        method: "POST",
        headers: { Authorization: "Bearer wrong-secret" },
      }),
    );
    expect(wrong.status).toBe(401);

    const ok = await drainPost(
      new Request("http://localhost/api/v1/internal/worker/drain", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: "should-be-ignored",
          queueIds: ["x"],
          concurrency: 999,
          batchSize: 999,
        }),
      }),
    );
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.data).toHaveProperty("queuesClaimed");
    expect(body.data).not.toHaveProperty("organizationId");
    expect(JSON.stringify(body)).not.toContain(process.env.CRON_SECRET);
  });
});
