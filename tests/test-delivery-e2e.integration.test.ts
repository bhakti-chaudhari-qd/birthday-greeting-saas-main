import {
  Channel,
  ChannelProvider,
  DeliveryStatus,
  QueueStatus,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { upsertSmsChannelConfig } from "@/lib/channel-config/service";
import { upsertWhatsAppChannelConfig } from "@/lib/channel-config/whatsapp-service";
import { createContact } from "@/lib/contacts/service";
import { listDeliveries } from "@/lib/deliveries/list";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { prisma } from "@/lib/db";
import { executeManualSend } from "@/lib/queue/manual-send";
import { runMessageWorker } from "@/lib/queue/worker";
import { createTemplate } from "@/lib/templates/service";

import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";
import { uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;



function registerInput(suffix: string) {
  return {
    organizationName: `E2E Delivery Org ${suffix}`,
    organizationSlug: `e2e-delivery-org-${suffix}`,
    timezone: "UTC",
    adminName: "E2E Admin",
    email: `e2e-delivery-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("TEST end-to-end delivery flow", () => {
  beforeAll(async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_CREDENTIALS_ENCRYPTION_KEY;

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

  it("Manual SMS Send → worker → TEST DeliveryLog visible via listDeliveries", async ({
    skip,
  }) => {
    if (!databaseAvailable) {
      skip();
    }

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const foreign = await createRegisteredOrganization(
      registerInput(`${uniqueSuffix()}-foreign`),
    );

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
      const template = await createTemplate(org.organization.id, {
        name: "E2E SMS",
        occasionId: birthday.id,
        channel: Channel.SMS,
        body: "Hello {{name}}!",
        isActive: true,
      });

      const contact = await createContact(org.organization.id, {
        name: "E2E Person",
        mobile: testMobile(),

        isActive: true,
      });

      const usageBefore = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });

      const queued = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      }, { createdByUserId: org.user.id });

      expect(queued.creation.created).toBe(1);
      expect(queued.creation.queueIds).toHaveLength(1);

      const pending = await prisma.sendQueue.findUniqueOrThrow({
        where: { id: queued.creation.queueIds[0]! },
      });
      expect(pending.status).toBe(QueueStatus.PENDING);
      expect(pending.attemptCount).toBe(0);

      const usageAfterEnqueue = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });
      expect(usageAfterEnqueue.messagesSentThisMonth).toBe(
        usageBefore.messagesSentThisMonth + 1,
      );

      const summary = await runMessageWorker();
      expect(summary.queuesClaimed).toBeGreaterThanOrEqual(1);
      expect(summary.sent).toBeGreaterThanOrEqual(1);

      const sentQueue = await prisma.sendQueue.findUniqueOrThrow({
        where: { id: pending.id },
      });
      expect(sentQueue.status).toBe(QueueStatus.SENT);
      expect(sentQueue.attemptCount).toBe(1);

      const usageAfterWorker = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });
      expect(usageAfterWorker.messagesSentThisMonth).toBe(
        usageAfterEnqueue.messagesSentThisMonth,
      );

      const listed = await listDeliveries(org.organization.id, {
        page: 1,
        limit: 10,
      });

      expect(listed.meta.total).toBe(1);
      expect(listed.data).toHaveLength(1);
      expect(listed.data[0]?.provider).toBe(ChannelProvider.TEST);
      expect(listed.data[0]?.status).toBe(DeliveryStatus.SENT);
      expect(listed.data[0]?.providerMessageId).toMatch(/^test-/);
      expect(listed.data[0]?.providerMessageId).not.toMatch(/^test-wa-/);
      expect(listed.data[0]?.sendQueueId).toBe(pending.id);

      const foreignListed = await listDeliveries(foreign.organization.id, {
        page: 1,
        limit: 10,
      });
      expect(foreignListed.meta.total).toBe(0);
      expect(foreignListed.data).toHaveLength(0);

      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      await cleanupOrganization(org.organization.id);
      await cleanupOrganization(foreign.organization.id);
    }
  });

  it("Manual WhatsApp Send → worker → TEST DeliveryLog visible via listDeliveries", async ({
    skip,
  }) => {
    if (!databaseAvailable) {
      skip();
    }

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const foreign = await createRegisteredOrganization(
      registerInput(`${uniqueSuffix()}-foreign`),
    );

    try {
      await upsertWhatsAppChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
      const template = await createTemplate(org.organization.id, {
        name: "E2E WA",
        occasionId: birthday.id,
        channel: Channel.WHATSAPP,
        body: "Hello {{name}}",
        isActive: true,
        whatsappTemplateName: "e2e_template",
        whatsappLanguage: "en",
      });

      const contact = await createContact(org.organization.id, {
        name: "E2E WA Person",
        mobile: testMobile(),

        isActive: true,
      });

      const usageBefore = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });

      const queued = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      }, { createdByUserId: org.user.id });

      expect(queued.creation.created).toBe(1);
      const queueId = queued.creation.queueIds[0]!;

      const pending = await prisma.sendQueue.findUniqueOrThrow({
        where: { id: queueId },
      });
      expect(pending.status).toBe(QueueStatus.PENDING);
      expect(pending.channel).toBe(Channel.WHATSAPP);

      const usageAfterEnqueue = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });
      expect(usageAfterEnqueue.messagesSentThisMonth).toBe(
        usageBefore.messagesSentThisMonth + 1,
      );

      const summary = await runMessageWorker();
      expect(summary.queuesClaimed).toBeGreaterThanOrEqual(1);
      expect(summary.sent).toBeGreaterThanOrEqual(1);

      const sentQueue = await prisma.sendQueue.findUniqueOrThrow({
        where: { id: queueId },
      });
      expect(sentQueue.status).toBe(QueueStatus.SENT);

      const usageAfterWorker = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });
      expect(usageAfterWorker.messagesSentThisMonth).toBe(
        usageAfterEnqueue.messagesSentThisMonth,
      );

      const listed = await listDeliveries(org.organization.id, {
        page: 1,
        limit: 10,
      });

      expect(listed.meta.total).toBe(1);
      expect(listed.data[0]?.provider).toBe(ChannelProvider.TEST);
      expect(listed.data[0]?.status).toBe(DeliveryStatus.SENT);
      expect(listed.data[0]?.providerMessageId).toMatch(/^test-wa-/);
      expect(listed.data[0]?.channel).toBe(Channel.WHATSAPP);

      const foreignListed = await listDeliveries(foreign.organization.id, {
        page: 1,
        limit: 10,
      });
      expect(foreignListed.meta.total).toBe(0);

      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      await cleanupOrganization(org.organization.id);
      await cleanupOrganization(foreign.organization.id);
    }
  });
});
