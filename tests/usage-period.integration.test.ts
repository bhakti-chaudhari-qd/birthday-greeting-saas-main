import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChannelProvider, QueueStatus } from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { upsertSmsChannelConfig } from "@/lib/channel-config/service";
import { createContact } from "@/lib/contacts/service";
import {
  getIstMonthKey,
  getIstUsagePeriodBounds,
  lockSubscriptionForQueueGeneration,
} from "@/lib/queue/limits";
import { generateOccasionQueue } from "@/lib/queue/generate";
import { executeManualSend } from "@/lib/queue/manual-send";
import { sendQueueItem } from "@/lib/queue/send";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { USAGE_PERIOD_TIMEZONE } from "@/lib/queue/constants";
import { uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;


function registerInput(suffix: string) {
  return {
    organizationName: `Usage Org ${suffix}`,
    organizationSlug: `usage-org-${suffix}`,
    timezone: "UTC",
    adminName: "Usage Admin",
    email: `usage-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

describe("IST monthly usage period", () => {
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

  it("resets counter and bonus credits on first reservation in a new IST month under lock", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const bounds = getIstUsagePeriodBounds(new Date("2026-06-15T12:00:00.000Z"));

    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: {
        messagesSentThisMonth: 40,
        monthlyMessageLimit: 100,
        bonusMessageCredits: 5000,
        billingPeriodStart: bounds.periodStart,
        billingPeriodEnd: bounds.periodEnd,
      },
    });

    const julyReference = new Date("2026-07-05T06:30:00.000Z");
    const julyBounds = getIstUsagePeriodBounds(julyReference);

    await prisma.$transaction(async (tx) => {
      const { subscription } = await lockSubscriptionForQueueGeneration(
        org.organization.id,
        tx,
        julyReference,
      );
      expect(subscription.messagesSentThisMonth).toBe(0);
      expect(subscription.bonusMessageCredits).toBe(0);
      expect(getIstMonthKey(subscription.billingPeriodStart)).toBe(
        getIstMonthKey(julyBounds.periodStart),
      );
      expect(subscription.billingPeriodEnd?.toISOString()).toBe(
        julyBounds.periodEnd.toISOString(),
      );
    });

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("preserves bonus credits within the same IST month", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const now = new Date();
    const bounds = getIstUsagePeriodBounds(now);

    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: {
        messagesSentThisMonth: 7,
        bonusMessageCredits: 2500,
        billingPeriodStart: bounds.periodStart,
        billingPeriodEnd: bounds.periodEnd,
      },
    });

    await prisma.$transaction(async (tx) => {
      const { subscription } = await lockSubscriptionForQueueGeneration(
        org.organization.id,
        tx,
        now,
      );
      expect(subscription.messagesSentThisMonth).toBe(7);
      expect(subscription.bonusMessageCredits).toBe(2500);
    });

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("handles concurrent first-of-month reservations without exceeding capacity", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(org.organization.id, {
      name: "Birthday SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });

    const june = getIstUsagePeriodBounds(new Date("2026-06-10T00:00:00.000Z"));
    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: {
        messagesSentThisMonth: 99,
        monthlyMessageLimit: 100,
        billingPeriodStart: june.periodStart,
        billingPeriodEnd: june.periodEnd,
      },
    });

    const contacts = await Promise.all(
      [0, 1, 2].map(async (index) =>
        createContact(org.organization.id, {
          name: `Contact ${index}`,
          mobile: testMobile(),
          occasionDates: { [birthday.id]: "1990-07-12" },

          isActive: true,
        }),
      ),
    );

    const julyReference = new Date("2026-07-12T05:00:00.000Z");

    // Force generate to use lock path with injected date by updating watermark
    // then generating (generation uses lockSubscription which uses Date.now()).
    // Simulate by resetting via lock then generating with capacity 1 remaining after reset.
    await prisma.$transaction(async (tx) => {
      await lockSubscriptionForQueueGeneration(
        org.organization.id,
        tx,
        julyReference,
      );
    });

    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: { messagesSentThisMonth: 0, monthlyMessageLimit: 2 },
    });

    const [first, second] = await Promise.all([
      generateOccasionQueue(org.organization.id, birthday.id, {
        templateId: template.id,
        targetDate: "2026-07-12",
      }),
      generateOccasionQueue(org.organization.id, birthday.id, {
        templateId: template.id,
        targetDate: "2026-07-12",
      }),
    ]);

    const created = first.created + second.created;
    expect(created).toBeLessThanOrEqual(2);

    const subscription = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: org.organization.id },
    });
    expect(subscription.messagesSentThisMonth).toBeLessThanOrEqual(2);
    expect(subscription.messagesSentThisMonth).toBe(created);

    void contacts;
    expect(USAGE_PERIOD_TIMEZONE).toBe("Asia/Kolkata");

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("does not consume new-month capacity when delivering old-month queue rows", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    await upsertSmsChannelConfig(org.organization.id, {
      provider: ChannelProvider.TEST,
      isActive: true,
    });
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(org.organization.id, {
      name: "Custom SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Hello {{name}}!",
      isActive: true,
    });
    const contact = await createContact(org.organization.id, {
      name: "Queued Person",
      mobile: testMobile(),

      isActive: true,
    });

    const result = await executeManualSend(org.organization.id, {
      templateId: template.id,
      contactIds: [contact.id],
    }, { createdByUserId: org.user.id });
    expect(result.queued.created).toBe(1);

    const afterCreate = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: org.organization.id },
    });
    expect(afterCreate.messagesSentThisMonth).toBe(1);

    // Move watermark to previous month while leaving the queue row and counter.
    const previous = getIstUsagePeriodBounds(
      new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    );
    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: {
        messagesSentThisMonth: 1,
        billingPeriodStart: previous.periodStart,
        billingPeriodEnd: previous.periodEnd,
      },
    });

    await sendQueueItem(org.organization.id, result.creation.queueIds[0]!);

    const afterSend = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: org.organization.id },
    });
    // Delivery must not increment; stale watermark is only touched on new reservation.
    expect(afterSend.messagesSentThisMonth).toBe(1);

    const queue = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: result.creation.queueIds[0]! },
    });
    expect(queue.status).toBe(QueueStatus.SENT);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });
});
