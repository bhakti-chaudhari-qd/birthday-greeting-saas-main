import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Channel, ChannelProvider, SubscriptionPlan } from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { createTemplate } from "@/lib/templates/service";
import { executeManualSend } from "@/lib/queue/manual-send";
import { upsertSmsChannelConfig } from "@/lib/channel-config/service";
import { upsertWhatsAppChannelConfig } from "@/lib/channel-config/whatsapp-service";
import {
  getIstUsagePeriodBounds,
  getRemainingCapacityForChannel,
  lockSubscriptionForQueueGeneration,
} from "@/lib/queue/limits";
import { prisma } from "@/lib/db";
import { cleanupOrganization, uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `Channel Limit Org ${suffix}`,
    organizationSlug: `channel-limit-org-${suffix}`,
    timezone: "UTC",
    adminName: "Channel Limit Admin",
    email: `channel-limit-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

async function makeContacts(organizationId: string, count: number) {
  const contacts = [];
  for (let i = 0; i < count; i += 1) {
    contacts.push(
      await createContact(organizationId, {
        name: `Contact ${i}`,
        mobile: testMobile(),
        isActive: true,
      }),
    );
  }
  return contacts;
}

describe("per-channel message limits", () => {
  const previousEncryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY;

  beforeAll(async () => {
    if (!process.env.CREDENTIALS_ENCRYPTION_KEY) {
      // WhatsApp TEST channel config requires this to encrypt its (empty)
      // credentials payload; .env.local has it but vitest only loads .env.
      process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
        "base64",
      );
    }
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
    if (previousEncryptionKey === undefined) {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    } else {
      process.env.CREDENTIALS_ENCRYPTION_KEY = previousEncryptionKey;
    }
    await prisma.$disconnect();
  });

  it("enforces per-channel limits independently for a CUSTOM plan with channel rows", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
      const subscription = await prisma.subscription.update({
        where: { organizationId: org.organization.id },
        data: { plan: SubscriptionPlan.CUSTOM, monthlyMessageLimit: 999 },
      });
      await prisma.channelMessageLimit.createMany({
        data: [
          { subscriptionId: subscription.id, channel: Channel.SMS, monthlyLimit: 1 },
          {
            subscriptionId: subscription.id,
            channel: Channel.WHATSAPP,
            monthlyLimit: 5,
          },
        ],
      });

      await upsertWhatsAppChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      const smsTemplate = await createTemplate(org.organization.id, {
        name: "SMS",
        occasionId: birthday.id,
        channel: "SMS",
        body: "Hello {{name}}!",
        isActive: true,
        replaceExisting: false,
      });
      const whatsappTemplate = await createTemplate(org.organization.id, {
        name: "WhatsApp",
        occasionId: birthday.id,
        channel: "WHATSAPP",
        body: "Hello {{name}}!",
        isActive: true,
        replaceExisting: false,
        whatsappTemplateName: "hello_template",
        whatsappLanguage: "en",
      });

      const contacts = await makeContacts(org.organization.id, 2);

      const smsResult = await executeManualSend(org.organization.id, {
        templateId: smsTemplate.id,
        contactIds: contacts.map((c) => c.id),
      }, { createdByUserId: org.user.id });
      // SMS channel allocation is 1: only one of the two contacts is queued.
      expect(smsResult.creation.created).toBe(1);
      expect(smsResult.creation.skippedLimit).toBe(1);

      const whatsappResult = await executeManualSend(org.organization.id, {
        templateId: whatsappTemplate.id,
        contactIds: contacts.map((c) => c.id),
      }, { createdByUserId: org.user.id });
      // WhatsApp channel has its own separate allocation (5), unaffected by SMS exhaustion.
      expect(whatsappResult.creation.created).toBe(2);
      expect(whatsappResult.creation.skippedLimit).toBe(0);

      const updatedSubscription = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });
      // Aggregate counter stays accurate (dual-write) for dashboards/alerts.
      expect(updatedSubscription.messagesSentThisMonth).toBe(3);

      const channelLimits = await prisma.channelMessageLimit.findMany({
        where: { subscriptionId: subscription.id },
        orderBy: { channel: "asc" },
      });
      const sms = channelLimits.find((c) => c.channel === Channel.SMS)!;
      const whatsapp = channelLimits.find((c) => c.channel === Channel.WHATSAPP)!;
      expect(sms.messagesSentThisMonth).toBe(1);
      expect(whatsapp.messagesSentThisMonth).toBe(2);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("falls back to the aggregate limit for a CUSTOM org with no channel rows yet", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });
      const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
      await prisma.subscription.update({
        where: { organizationId: org.organization.id },
        data: { plan: SubscriptionPlan.CUSTOM, monthlyMessageLimit: 2 },
      });

      const template = await createTemplate(org.organization.id, {
        name: "SMS",
        occasionId: birthday.id,
        channel: "SMS",
        body: "Hello {{name}}!",
        isActive: true,
        replaceExisting: false,
      });
      const contacts = await makeContacts(org.organization.id, 3);

      const result = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: contacts.map((c) => c.id),
      }, { createdByUserId: org.user.id });

      // No ChannelMessageLimit rows exist for this CUSTOM org, so behavior is
      // unchanged from before this feature: the aggregate limit (2) governs.
      expect(result.creation.created).toBe(2);
      expect(result.creation.skippedLimit).toBe(1);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("ignores stray channel rows for non-CUSTOM plans and uses the aggregate limit", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });
      const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
      const subscription = await prisma.subscription.update({
        where: { organizationId: org.organization.id },
        data: { plan: SubscriptionPlan.STARTER, monthlyMessageLimit: 2 },
      });
      // Even if a channel row exists, non-CUSTOM plans must not use it.
      await prisma.channelMessageLimit.create({
        data: { subscriptionId: subscription.id, channel: Channel.SMS, monthlyLimit: 1 },
      });

      const template = await createTemplate(org.organization.id, {
        name: "SMS",
        occasionId: birthday.id,
        channel: "SMS",
        body: "Hello {{name}}!",
        isActive: true,
        replaceExisting: false,
      });
      const contacts = await makeContacts(org.organization.id, 3);

      const result = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: contacts.map((c) => c.id),
      }, { createdByUserId: org.user.id });

      expect(result.creation.created).toBe(2);
      expect(result.creation.skippedLimit).toBe(1);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("resets both aggregate and per-channel usage on IST monthly rollover", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      const subscription = await prisma.subscription.update({
        where: { organizationId: org.organization.id },
        data: { plan: SubscriptionPlan.CUSTOM, monthlyMessageLimit: 999 },
      });
      const bounds = getIstUsagePeriodBounds(new Date("2026-06-15T12:00:00.000Z"));
      await prisma.subscription.update({
        where: { organizationId: org.organization.id },
        data: {
          messagesSentThisMonth: 40,
          billingPeriodStart: bounds.periodStart,
          billingPeriodEnd: bounds.periodEnd,
        },
      });
      await prisma.channelMessageLimit.create({
        data: {
          subscriptionId: subscription.id,
          channel: Channel.SMS,
          monthlyLimit: 100,
          messagesSentThisMonth: 40,
        },
      });

      const julyReference = new Date("2026-07-05T06:30:00.000Z");
      await prisma.$transaction(async (tx) => {
        const { subscription: locked, channelLimits } =
          await lockSubscriptionForQueueGeneration(
            org.organization.id,
            tx,
            julyReference,
          );
        expect(locked.messagesSentThisMonth).toBe(0);
        const smsLimit = channelLimits.get(Channel.SMS)!;
        expect(smsLimit.messagesSentThisMonth).toBe(0);
        expect(
          getRemainingCapacityForChannel(locked, channelLimits, Channel.SMS, 999),
        ).toBe(100);
      });
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });
});
