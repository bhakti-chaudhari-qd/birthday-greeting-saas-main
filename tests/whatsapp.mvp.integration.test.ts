import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  Channel,
  ChannelProvider,
  DeliveryStatus,
  QueueStatus,
} from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import {
  getWhatsAppChannelConfig,
  updateWhatsAppChannelMedia,
  upsertWhatsAppChannelConfig,
} from "@/lib/channel-config/whatsapp-service";
import { prisma } from "@/lib/db";
import { refreshDeliveryStatus } from "@/lib/deliveries/refresh";
import { DeliveryRefreshError } from "@/lib/deliveries/errors";
import { createTemplate, updateTemplate } from "@/lib/templates/service";
import { TemplateValidationError } from "@/lib/templates/errors";
import {
  executeManualSend,
  previewManualSend,
} from "@/lib/queue/manual-send";
import { processClaimedQueueItem } from "@/lib/queue/send";
import { claimQueueItemsForOrganization } from "@/lib/queue/claim";
import { runMessageWorker } from "@/lib/queue/worker";
import { createTemplateSchema } from "@/lib/validation/template";
import { testProvider } from "@/lib/messaging/providers/test-provider";

import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";
import { uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;


const TEST_OCCASION_ID = "cltest00000000000000000001";

function registerInput(suffix: string) {
  return {
    organizationName: `WhatsApp Org ${suffix}`,
    organizationSlug: `whatsapp-org-${suffix}`,
    timezone: "UTC",
    adminName: "WhatsApp Admin",
    email: `whatsapp-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("WhatsApp MVP foundation", () => {
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

  it("accepts WhatsApp template creation input and rejects SMS WhatsApp metadata", () => {
    const valid = createTemplateSchema.safeParse({
      name: "Birthday WA",
      occasionId: TEST_OCCASION_ID,
      channel: "WHATSAPP",
      body: "Hello {{name}}",
      whatsappTemplateName: "birthday_greeting",
      whatsappLanguage: "en",
    });
    expect(valid.success).toBe(true);

    const invalidSms = createTemplateSchema.safeParse({
      name: "Birthday SMS",
      occasionId: TEST_OCCASION_ID,
      channel: "SMS",
      body: "Hello {{name}}",
      whatsappTemplateName: "birthday_greeting",
    });
    expect(invalidSms.success).toBe(false);
  });

  it("configures TEST WhatsApp channel with safe serialization and tenant isolation", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const orgB = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      const unset = await getWhatsAppChannelConfig(orgA.organization.id);
      expect(unset.configured).toBe(false);

      const saved = await upsertWhatsAppChannelConfig(orgA.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      expect(saved.configured).toBe(true);
      expect(saved.provider).toBe(ChannelProvider.TEST);
      expect(saved.credentialsConfigured).toBe(false);
      expect(saved).not.toHaveProperty("encryptedCredentials");

      const applied = await updateWhatsAppChannelMedia(orgA.organization.id, {
        mediaBase64: Buffer.from([
          0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f,
          0x6d,
        ]).toString("base64"),
        mediaFilename: "local-greeting.mp4",
        mediaContentType: "video/mp4",
      });
      expect(applied.mediaConfigured).toBe(true);
      expect(applied.mediaFilename).toBe("local-greeting.mp4");
      expect(applied.mediaContentType).toBe("video/mp4");

      const other = await getWhatsAppChannelConfig(orgB.organization.id);
      expect(other.configured).toBe(false);

      const smsConfig = await prisma.channelConfig.findUnique({
        where: {
          organizationId_channel: {
            organizationId: orgA.organization.id,
            channel: Channel.SMS,
          },
        },
      });
      expect(smsConfig).toBeNull();
    } finally {
      await cleanupOrganization(orgA.organization.id);
      await cleanupOrganization(orgB.organization.id);
    }
  });

  it("creates WhatsApp templates with required metadata and rejects missing fields", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    try {
      await expect(
        createTemplate(org.organization.id, {
          name: "WA Missing",
          occasionId: birthday.id,
          channel: Channel.WHATSAPP,
          body: "Hello {{name}}",
          isActive: true,
        } as never),
      ).rejects.toBeTruthy();

      const template = await createTemplate(org.organization.id, {
        name: "WA Birthday",
        occasionId: birthday.id,
        channel: Channel.WHATSAPP,
        body: "Hello {{name}}",
        isActive: true,
        whatsappTemplateName: "birthday_greeting",
        whatsappLanguage: "en",
      });

      expect(template.channel).toBe(Channel.WHATSAPP);
      expect(template.whatsappTemplateName).toBe("birthday_greeting");
      expect(template.whatsappLanguage).toBe("en");
      expect(template.whatsappParameterOrder).toEqual(["name"]);
      expect(template.dltTemplateId).toBeNull();

      await expect(
        updateTemplate(org.organization.id, template.id, {
          whatsappTemplateName: "",
        }),
      ).rejects.toBeInstanceOf(TemplateValidationError);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("queues Manual WhatsApp Send with immutable snapshots and no provider call", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    let originalSend: typeof testProvider.send | null = null;

    try {
      await upsertWhatsAppChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      const template = await createTemplate(org.organization.id, {
        name: "WA Custom",
        occasionId: birthday.id,
        channel: Channel.WHATSAPP,
        body: "Hello {{name}}",
        isActive: true,
        whatsappTemplateName: "hello_template",
        whatsappLanguage: "en_US",
      });

      const contact = await prisma.contact.create({
        data: {
          organizationId: org.organization.id,
          name: "Priya",
          mobile: "9876543001",
          isActive: true,
        },
      });

      originalSend = testProvider.send;
      let providerCalls = 0;
      testProvider.send = async (...args) => {
        providerCalls += 1;
        return originalSend!(...args);
      };

      const preview = await previewManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      });
      expect(preview.providerModeLabel).toBe("Test mode");
      expect(preview.template.channel).toBe(Channel.WHATSAPP);
      expect(providerCalls).toBe(0);

      const beforeUsage = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });

      const result = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      }, { createdByUserId: org.user.id });

      expect(result.queued.created).toBe(1);
      expect(providerCalls).toBe(0);

      const queue = await prisma.sendQueue.findUniqueOrThrow({
        where: { id: result.creation.queueIds[0] },
      });

      expect(queue.channel).toBe(Channel.WHATSAPP);
      expect(queue.whatsappTemplateName).toBe("hello_template");
      expect(queue.whatsappLanguage).toBe("en_US");
      expect(queue.whatsappParameterValues).toEqual(["Priya"]);
      expect(queue.renderedBody).toContain("Priya");

      await updateTemplate(org.organization.id, template.id, {
        whatsappTemplateName: "changed_later",
        whatsappLanguage: "hi",
        body: "Changed {{name}}",
      });

      const unchanged = await prisma.sendQueue.findUniqueOrThrow({
        where: { id: queue.id },
      });
      expect(unchanged.whatsappTemplateName).toBe("hello_template");
      expect(unchanged.whatsappLanguage).toBe("en_US");
      expect(unchanged.whatsappParameterValues).toEqual(["Priya"]);
      expect(unchanged.renderedBody).toBe(queue.renderedBody);

      const afterUsage = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });
      expect(afterUsage.messagesSentThisMonth).toBe(
        beforeUsage.messagesSentThisMonth + 1,
      );
    } finally {
      if (originalSend) {
        testProvider.send = originalSend;
      }
      await cleanupOrganization(org.organization.id);
    }
  });

  it("fails closed when WhatsApp config is missing", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    try {
      const template = await createTemplate(org.organization.id, {
        name: "WA No Config",
        occasionId: birthday.id,
        channel: Channel.WHATSAPP,
        body: "Hello {{name}}",
        isActive: true,
        whatsappTemplateName: "hello_template",
        whatsappLanguage: "en",
      });

      const contact = await prisma.contact.create({
        data: {
          organizationId: org.organization.id,
          name: "NoConfig",
          mobile: "9876543002",
          isActive: true,
        },
      });

      await expect(
        executeManualSend(org.organization.id, {
          templateId: template.id,
          contactIds: [contact.id],
        }, { createdByUserId: org.user.id }),
      ).rejects.toThrow(/WhatsApp channel must be configured/);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("rejects cross-tenant WhatsApp template and contact usage", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const orgB = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthdayB = await ensureSystemBirthdayOccasion(orgB.organization.id);

    try {
      await upsertWhatsAppChannelConfig(orgA.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });
      await upsertWhatsAppChannelConfig(orgB.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      const templateB = await createTemplate(orgB.organization.id, {
        name: "WA Other",
        occasionId: birthdayB.id,
        channel: Channel.WHATSAPP,
        body: "Hello {{name}}",
        isActive: true,
        whatsappTemplateName: "other_template",
        whatsappLanguage: "en",
      });

      const contactA = await prisma.contact.create({
        data: {
          organizationId: orgA.organization.id,
          name: "TenantA",
          mobile: "9876543003",
          isActive: true,
        },
      });

      await expect(
        executeManualSend(orgA.organization.id, {
          templateId: templateB.id,
          contactIds: [contactA.id],
        }, { createdByUserId: orgA.user.id }),
      ).rejects.toThrow();
    } finally {
      await cleanupOrganization(orgA.organization.id);
      await cleanupOrganization(orgB.organization.id);
    }
  });

  it("worker delivers WhatsApp TEST rows with structured request and DeliveryLog", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    let seenRequest: unknown = null;
    const originalSend = testProvider.send;

    try {
      await upsertWhatsAppChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      const template = await createTemplate(org.organization.id, {
        name: "WA Worker",
        occasionId: birthday.id,
        channel: Channel.WHATSAPP,
        body: "Hello {{name}}",
        isActive: true,
        whatsappTemplateName: "worker_template",
        whatsappLanguage: "en",
      });

      const contact = await prisma.contact.create({
        data: {
          organizationId: org.organization.id,
          name: "WorkerUser",
          mobile: "9876543004",
          isActive: true,
        },
      });

      const queued = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      }, { createdByUserId: org.user.id });

      const usageAfterCreate = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });

      testProvider.send = async (request) => {
        seenRequest = request;
        return originalSend(request);
      };

      const claimed = await claimQueueItemsForOrganization(
        org.organization.id,
        { limit: 25 },
      );
      expect(claimed).toHaveLength(1);

      const sendResult = await processClaimedQueueItem(
        org.organization.id,
        claimed[0]!.id,
      );

      expect(sendResult.status).toBe("sent");
      expect(seenRequest).toMatchObject({
        channel: "WHATSAPP",
        templateName: "worker_template",
        language: "en",
        parameterValues: ["WorkerUser"],
        recipient: "9876543004",
      });
      expect(seenRequest).not.toHaveProperty("dltTemplateId");

      const queue = await prisma.sendQueue.findUniqueOrThrow({
        where: { id: queued.creation.queueIds[0] },
      });
      expect(queue.status).toBe(QueueStatus.SENT);

      const logs = await prisma.deliveryLog.findMany({
        where: { sendQueueId: queue.id, organizationId: org.organization.id },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0]?.status).toBe(DeliveryStatus.SENT);
      expect(logs[0]?.providerMessageId).toMatch(/^test-wa-/);

      const usageAfterSend = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });
      expect(usageAfterSend.messagesSentThisMonth).toBe(
        usageAfterCreate.messagesSentThisMonth,
      );

      await expect(
        refreshDeliveryStatus(org.organization.id, logs[0]!.id),
      ).rejects.toBeInstanceOf(DeliveryRefreshError);

      const unchangedLog = await prisma.deliveryLog.findUniqueOrThrow({
        where: { id: logs[0]!.id },
      });
      expect(unchangedLog.status).toBe(DeliveryStatus.SENT);
      expect(unchangedLog.providerResponse).toEqual(logs[0]?.providerResponse);
    } finally {
      testProvider.send = originalSend;
      await cleanupOrganization(org.organization.id);
    }
  });

  it("existing worker drain processes WhatsApp queue rows", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    try {
      await upsertWhatsAppChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      const template = await createTemplate(org.organization.id, {
        name: "WA Drain",
        occasionId: birthday.id,
        channel: Channel.WHATSAPP,
        body: "Hello {{name}}",
        isActive: true,
        whatsappTemplateName: "drain_template",
        whatsappLanguage: "en",
      });

      const contact = await prisma.contact.create({
        data: {
          organizationId: org.organization.id,
          name: "DrainUser",
          mobile: "9876543005",
          isActive: true,
        },
      });

      await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      }, { createdByUserId: org.user.id });

      const summary = await runMessageWorker();
      expect(summary.sent).toBeGreaterThanOrEqual(1);

      const queue = await prisma.sendQueue.findFirst({
        where: {
          organizationId: org.organization.id,
          channel: Channel.WHATSAPP,
        },
      });
      expect(queue?.status).toBe(QueueStatus.SENT);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("keeps SMS rows valid with null WhatsApp snapshot fields", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    try {
      const smsTemplate = await createTemplate(org.organization.id, {
        name: "SMS Compat",
        occasionId: birthday.id,
        channel: Channel.SMS,
        body: "Happy Birthday {{name}}!",
        isActive: true,
      });

      expect(smsTemplate.whatsappTemplateName).toBeNull();
      expect(smsTemplate.whatsappParameterOrder).toEqual([]);

      const contact = await prisma.contact.create({
        data: {
          organizationId: org.organization.id,
          name: "SmsCompat",
          mobile: "9876543006",
          isActive: true,
        },
      });

      const queue = await prisma.sendQueue.create({
        data: {
          organizationId: org.organization.id,
          contactId: contact.id,
          recipientName: contact.name,
          recipientMobile: contact.mobile,
          recipientEmail: contact.email,
          templateId: smsTemplate.id,
          channel: Channel.SMS,
          occasionId: birthday.id,
          scheduledDate: new Date("2026-07-12"),
          renderedBody: "Happy Birthday!",
          status: QueueStatus.PENDING,
          idempotencyKey: `sms-compat-${uniqueSuffix()}`,
        },
      });

      expect(queue.whatsappTemplateName).toBeNull();
      expect(queue.whatsappLanguage).toBeNull();
      expect(queue.whatsappParameterValues).toBeNull();
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });
});
