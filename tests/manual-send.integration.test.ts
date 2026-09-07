import { Channel, ChannelProvider } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { upsertSmsChannelConfig } from "@/lib/channel-config/service";
import { createContact } from "@/lib/contacts/service";
import { listDeliveries } from "@/lib/deliveries/list";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import {
  QueueTemplateNotFoundError,
  QueueTemplateRejectedError,
  QueueValidationError,
} from "@/lib/queue/errors";
import {
  executeManualSend,
  previewManualSend,
} from "@/lib/queue/manual-send";
import { sendQueueItem, sendQueueItems } from "@/lib/queue/send";
import { createTemplate } from "@/lib/templates/service";
import { updateTemplateSmsSetup } from "@/lib/templates/sms-setup";
import {
  dedupeContactIds,
  manualSendRequestSchema,
} from "@/lib/validation/manual-send";
import { prisma } from "@/lib/db";
import { buildSmsChannelConfigInput, TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;





function registerInput(suffix: string) {
  return {
    organizationName: `Manual Send Org ${suffix}`,
    organizationSlug: `manual-send-org-${suffix}`,
    timezone: "UTC",
    adminName: "Manual Send Admin",
    email: `manual-send-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

function smsTemplateInput(occasionId: string, name = "Manual SMS") {
  return {
    name,
    occasionId,
    channel: "SMS" as const,
    body: "Hello {{name}}!",
    isActive: true,
  };
}

async function setupManualSendOrg(options?: {
  templateBody?: string;
  configureCustomHttp?: boolean;
  configureDlt?: boolean;
  monthlyMessageLimit?: number;
  messagesSentThisMonth?: number;
}) {
  const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
  const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

  if (options?.monthlyMessageLimit !== undefined) {
    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: {
        monthlyMessageLimit: options.monthlyMessageLimit,
        messagesSentThisMonth: options.messagesSentThisMonth ?? 0,
      },
    });
  }

  if (options?.configureCustomHttp) {
    await prisma.channelConfig.create({
      data: {
        organizationId: org.organization.id,
        channel: Channel.SMS,
        ...buildSmsChannelConfigInput(),
      },
    });
  } else {
    await upsertSmsChannelConfig(org.organization.id, {
      provider: ChannelProvider.TEST,
      isActive: true,
    });
  }

  const template = await createTemplate(org.organization.id, {
    ...smsTemplateInput(birthday.id),
    body: options?.templateBody ?? "Hello {{name}}!",
  });

  if (options?.configureCustomHttp && options?.configureDlt !== false) {
    await updateTemplateSmsSetup(org.organization.id, template.id, {
      dltTemplateId: "DLT123456",
      dltApprovedContent: options?.templateBody ?? "Hello {{name}}!",
    });
  }

  const contact = await createContact(org.organization.id, {
    name: "Manual Person",
    mobile: testMobile(),
    occasionDates: { [birthday.id]: "1990-07-11" },

    isActive: true,
  });

  return { org, template, contact, birthday };
}

function failTestMobile() {
  return indianProviderFailMobile();
}

async function setupCustomHttpManualSendOrg(options?: {
  configureDlt?: boolean;
  fetchImpl?: typeof fetch;
}) {
  const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
  const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

  await prisma.channelConfig.create({
    data: {
      organizationId: org.organization.id,
      channel: Channel.SMS,
      ...buildSmsChannelConfigInput(),
    },
  });

  const template = await createTemplate(org.organization.id, {
    ...smsTemplateInput(birthday.id),
    body: "Hello {{name}}!",
  });

  if (options?.configureDlt !== false) {
    await updateTemplateSmsSetup(org.organization.id, template.id, {
      dltTemplateId: "DLT123456",
      dltApprovedContent: "Hello {{name}}!",
    });
  }

  const contact = await createContact(org.organization.id, {
    name: "Manual Person",
    mobile: testMobile(),
    occasionDates: { [birthday.id]: "1990-07-11" },

    isActive: true,
  });

  if (options?.fetchImpl) {
    vi.stubGlobal("fetch", options.fetchImpl);
  }

  return { org, template, contact, birthday };
}

describe("manual send integration", () => {
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("preview", () => {
    it("allows TEST templates without DLT setup", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg();
      const preview = await previewManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      });

      expect(preview.providerMode).toBe("TEST");
      expect(preview.providerModeLabel).toBe("Test mode");
      expect(preview.previews[0]?.renderedPreview).toBe("Hello Manual Person!");

      await cleanupOrganization(org.organization.id);
    });

    it("allows CUSTOM_HTTP ready templates", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg({
        configureCustomHttp: true,
      });
      const preview = await previewManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      });

      expect(preview.providerMode).toBe("CUSTOM_HTTP");
      expect(preview.providerModeLabel).toBe("Custom HTTP");

      await cleanupOrganization(org.organization.id);
    });

    it("rejects CUSTOM_HTTP non-ready templates", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg({
        configureCustomHttp: true,
        configureDlt: false,
      });

      await expect(
        previewManualSend(org.organization.id, {
          templateId: template.id,
          contactIds: [contact.id],
        }),
      ).rejects.toBeInstanceOf(QueueTemplateRejectedError);

      await cleanupOrganization(org.organization.id);
    });

    it("rejects foreign templates safely", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const orgA = await setupManualSendOrg();
      const orgB = await setupManualSendOrg();

      await expect(
        previewManualSend(orgB.org.organization.id, {
          templateId: orgA.template.id,
          contactIds: [orgB.contact.id],
        }),
      ).rejects.toBeInstanceOf(QueueTemplateNotFoundError);

      await cleanupOrganization(orgA.org.organization.id);
      await cleanupOrganization(orgB.org.organization.id);
    });

    it("rejects inactive templates", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg();
      await prisma.messageTemplate.update({
        where: { id: template.id },
        data: { isActive: false },
      });

      await expect(
        previewManualSend(org.organization.id, {
          templateId: template.id,
          contactIds: [contact.id],
        }),
      ).rejects.toBeInstanceOf(QueueTemplateRejectedError);

      await cleanupOrganization(org.organization.id);
    });

    it("rejects WhatsApp templates when WhatsApp channel is not configured", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const { org, contact, birthday } = await setupManualSendOrg();
      const whatsappTemplate = await createTemplate(org.organization.id, {
        name: "WhatsApp",
        occasionId: birthday.id,
        channel: "WHATSAPP",
        body: "Hello {{name}}!",
        isActive: true,
        whatsappTemplateName: "hello_template",
        whatsappLanguage: "en",
      });

      await expect(
        previewManualSend(org.organization.id, {
          templateId: whatsappTemplate.id,
          contactIds: [contact.id],
        }),
      ).rejects.toBeInstanceOf(QueueTemplateRejectedError);

      await cleanupOrganization(org.organization.id);
    });

    it("deduplicates contact IDs", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg();
      const preview = await previewManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id, contact.id],
      });

      expect(preview.recipientCount).toBe(1);

      await cleanupOrganization(org.organization.id);
    });

    it("rejects inactive contacts for the whole request", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg();
      await prisma.contact.update({
        where: { id: contact.id },
        data: { isActive: false },
      });

      await expect(
        previewManualSend(org.organization.id, {
          templateId: template.id,
          contactIds: [contact.id],
        }),
      ).rejects.toBeInstanceOf(QueueValidationError);

      await cleanupOrganization(org.organization.id);
    });

    it("rejects missing contacts for the whole request", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const { org, template } = await setupManualSendOrg();

      await expect(
        previewManualSend(org.organization.id, {
          templateId: template.id,
          contactIds: ["missing-contact-id"],
        }),
      ).rejects.toBeInstanceOf(QueueValidationError);

      await cleanupOrganization(org.organization.id);
    });

    it("rejects mixed own and foreign contacts atomically", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const orgA = await setupManualSendOrg();
      const orgB = await setupManualSendOrg();

      await expect(
        previewManualSend(orgA.org.organization.id, {
          templateId: orgA.template.id,
          contactIds: [orgA.contact.id, orgB.contact.id],
        }),
      ).rejects.toBeInstanceOf(QueueValidationError);

      await cleanupOrganization(orgA.org.organization.id);
      await cleanupOrganization(orgB.org.organization.id);
    });

    it("creates no queue rows, reserves no usage, and calls no provider", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg();
      const beforeUsage = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });

      await previewManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      });

      const queueCount = await prisma.sendQueue.count({
        where: { organizationId: org.organization.id },
      });
      const afterUsage = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });

      expect(queueCount).toBe(0);
      expect(afterUsage.messagesSentThisMonth).toBe(
        beforeUsage.messagesSentThisMonth,
      );

      await cleanupOrganization(org.organization.id);
    });
  });

  describe("manual send creation", () => {
    it("creates PENDING queue items on TEST happy path without delivering", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg();
      const beforeUsage = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });

      const result = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      }, { createdByUserId: org.user.id });

      expect(result.creation.created).toBe(1);
      expect(result.queued.created).toBe(1);
      expect(result.queued.requested).toBe(1);
      expect(result).not.toHaveProperty("send");

      const queue = await prisma.sendQueue.findFirstOrThrow({
        where: { organizationId: org.organization.id, contactId: contact.id },
      });
      expect(queue.occasionId).toBe(template.occasionId);
      expect(queue.renderedBody).toBe("Hello Manual Person!");
      expect(queue.status).toBe("PENDING");

      const deliveryLogs = await listDeliveries(org.organization.id, {
        page: 1,
        limit: 10,
      });
      expect(deliveryLogs.data).toHaveLength(0);

      const afterUsage = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });
      expect(afterUsage.messagesSentThisMonth).toBe(
        beforeUsage.messagesSentThisMonth + 1,
      );

      await cleanupOrganization(org.organization.id);
    });

    it("allows intentional same-day repeat sends across separate requests", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg();

      const first = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      }, { createdByUserId: org.user.id });
      const second = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      }, { createdByUserId: org.user.id });

      expect(first.creation.created).toBe(1);
      expect(second.creation.created).toBe(1);

      const queueCount = await prisma.sendQueue.count({
        where: { organizationId: org.organization.id, contactId: contact.id },
      });
      expect(queueCount).toBe(2);

      await cleanupOrganization(org.organization.id);
    });

    it("replays the same clientOperationId without creating duplicates or double-counting usage", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg();
      const clientOperationId = crypto.randomUUID();
      const beforeUsage = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });

      const first = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
        clientOperationId,
      }, { createdByUserId: org.user.id });
      const second = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
        clientOperationId,
      }, { createdByUserId: org.user.id });

      expect(first.creation.created).toBe(1);
      expect(second.creation.created).toBe(1);
      expect(second.creation.operationId).toBe(first.creation.operationId);
      expect(second.creation.queueIds).toEqual(first.creation.queueIds);

      const queueCount = await prisma.sendQueue.count({
        where: { organizationId: org.organization.id, contactId: contact.id },
      });
      expect(queueCount).toBe(1);

      const afterUsage = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });
      expect(afterUsage.messagesSentThisMonth).toBe(
        beforeUsage.messagesSentThisMonth + 1,
      );

      await cleanupOrganization(org.organization.id);
    });

    it("creates one queue item per unique contact within one request", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg();
      const result = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id, contact.id],
      }, { createdByUserId: org.user.id });

      expect(result.creation.requested).toBe(1);
      expect(result.creation.created).toBe(1);

      await cleanupOrganization(org.organization.id);
    });

    it("queues temporary Quick List recipients without creating contacts", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const { org, template } = await setupManualSendOrg();
      const beforeContacts = await prisma.contact.count({
        where: { organizationId: org.organization.id },
      });

      const result = await executeManualSend(org.organization.id, {
        templateId: template.id,
        recipients: [
          { name: "Quick Person", mobile: "9876543210" },
          { name: "", mobile: "9876543210" },
          { name: "", mobile: "9988776655" },
        ],
      }, { createdByUserId: org.user.id });

      expect(result.creation.requested).toBe(2);
      expect(result.creation.created).toBe(2);

      const queues = await prisma.sendQueue.findMany({
        where: { id: { in: result.creation.queueIds } },
        orderBy: { recipientMobile: "asc" },
      });
      expect(queues).toHaveLength(2);
      expect(queues).toEqual([
        expect.objectContaining({
          contactId: null,
          recipientName: "Quick Person",
          recipientMobile: "9876543210",
          renderedBody: "Hello Quick Person!",
        }),
        expect.objectContaining({
          contactId: null,
          recipientName: "Unnamed Recipient",
          recipientMobile: "9988776655",
          renderedBody: "Hello Unnamed Recipient!",
        }),
      ]);

      const afterContacts = await prisma.contact.count({
        where: { organizationId: org.organization.id },
      });
      expect(afterContacts).toBe(beforeContacts);

      await cleanupOrganization(org.organization.id);
    });

    it("rejects before queue creation when contacts are invalid", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const { org, template } = await setupManualSendOrg();
      const beforeUsage = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });

      await expect(
        executeManualSend(org.organization.id, {
          templateId: template.id,
          contactIds: ["missing-contact"],
        }, { createdByUserId: org.user.id }),
      ).rejects.toBeInstanceOf(QueueValidationError);

      const queueCount = await prisma.sendQueue.count({
        where: { organizationId: org.organization.id },
      });
      const afterUsage = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });

      expect(queueCount).toBe(0);
      expect(afterUsage.messagesSentThisMonth).toBe(
        beforeUsage.messagesSentThisMonth,
      );

      await cleanupOrganization(org.organization.id);
    });

    it("creates no queue rows when render fails", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg();
      await prisma.contact.update({
        where: { id: contact.id },
        data: { name: "" },
      });
      const beforeUsage = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });

      await expect(
        executeManualSend(org.organization.id, {
          templateId: template.id,
          contactIds: [contact.id],
        }, { createdByUserId: org.user.id }),
      ).rejects.toBeInstanceOf(QueueValidationError);

      const queueCount = await prisma.sendQueue.count({
        where: { organizationId: org.organization.id },
      });
      const afterUsage = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });

      expect(queueCount).toBe(0);
      expect(afterUsage.messagesSentThisMonth).toBe(
        beforeUsage.messagesSentThisMonth,
      );

      await cleanupOrganization(org.organization.id);
    });

    it("creates all queue rows when capacity is sufficient", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg({
        monthlyMessageLimit: 10,
        messagesSentThisMonth: 0,
      });
      const contactTwo = await createContact(org.organization.id, {
        name: "Second Person",
        mobile: testMobile(),
        isActive: true,
      });

      const result = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id, contactTwo.id],
      }, { createdByUserId: org.user.id });

      expect(result.creation.created).toBe(2);
      expect(result.creation.skippedLimit).toBe(0);

      await cleanupOrganization(org.organization.id);
    });

    it("creates a deterministic subset and reports skippedLimit", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg({
        monthlyMessageLimit: 1,
        messagesSentThisMonth: 0,
      });
      const contactTwo = await createContact(org.organization.id, {
        name: "Second Person",
        mobile: testMobile(),
        isActive: true,
      });

      const result = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id, contactTwo.id],
      }, { createdByUserId: org.user.id });

      expect(result.creation.created).toBe(1);
      expect(result.creation.skippedLimit).toBe(1);
      expect(result.creation.queueIds).toHaveLength(1);

      const queuedForFirstContact = await prisma.sendQueue.findFirst({
        where: {
          organizationId: org.organization.id,
          contactId: contact.id,
        },
      });
      const queuedForSecondContact = await prisma.sendQueue.findFirst({
        where: {
          organizationId: org.organization.id,
          contactId: contactTwo.id,
        },
      });

      expect(queuedForFirstContact).not.toBeNull();
      expect(queuedForSecondContact).toBeNull();

      await cleanupOrganization(org.organization.id);
    });

    it("creates zero queue rows and does not call provider at zero capacity", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg({
        monthlyMessageLimit: 1,
        messagesSentThisMonth: 1,
      });

      const result = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      }, { createdByUserId: org.user.id });

      expect(result.creation.created).toBe(0);
      expect(result.creation.skippedLimit).toBe(1);
      expect(result.queued.requested).toBe(1);
      expect(result.queued.created).toBe(0);
      expect(result.queued.skippedLimit).toBe(1);

      const queueCount = await prisma.sendQueue.count({
        where: { organizationId: org.organization.id },
      });
      expect(queueCount).toBe(0);

      await cleanupOrganization(org.organization.id);
    });

    it("reserves usage at create time and does not increment again on delivery", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg();
      const before = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });

      const result = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      }, { createdByUserId: org.user.id });

      const afterCreate = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });
      expect(afterCreate.messagesSentThisMonth).toBe(
        before.messagesSentThisMonth + 1,
      );

      await sendQueueItem(org.organization.id, result.creation.queueIds[0]!);

      const afterSend = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });
      expect(afterSend.messagesSentThisMonth).toBe(
        afterCreate.messagesSentThisMonth,
      );

      await cleanupOrganization(org.organization.id);
    });
  });

  describe("pipeline reuse", () => {
    it("produces SENT queue and DeliveryLog behavior through sendQueueItems", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg();
      const result = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      }, { createdByUserId: org.user.id });

      expect(result.queued.created).toBe(1);

      const sendSummary = await sendQueueItems(
        org.organization.id,
        result.creation.queueIds,
      );
      expect(sendSummary.sent).toBe(1);

      const deliveryLogs = await listDeliveries(org.organization.id, {
        page: 1,
        limit: 10,
      });
      expect(deliveryLogs.data).toHaveLength(1);
      expect(deliveryLogs.data[0]?.provider).toBe("TEST");

      await cleanupOrganization(org.organization.id);
    });

    it("reports partial provider failure semantics", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });
      const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
      const template = await createTemplate(
        org.organization.id,
        smsTemplateInput(birthday.id),
      );
      const successContact = await createContact(org.organization.id, {
        name: "Success Person",
        mobile: testMobile(),
        isActive: true,
      });
      const failContact = await createContact(org.organization.id, {
        name: "Fail Person",
        mobile: failTestMobile(),
        isActive: true,
      });

      const result = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [successContact.id, failContact.id],
      }, { createdByUserId: org.user.id });

      expect(result.queued.created).toBe(2);

      const sendSummary = await sendQueueItems(
        org.organization.id,
        result.creation.queueIds,
      );
      expect(sendSummary.sent).toBe(1);
      expect(sendSummary.retryScheduled).toBe(1);

      await cleanupOrganization(org.organization.id);
    });

    it("uses mocked fetch for CUSTOM_HTTP happy path", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "1|1|987654321",
      }) as typeof fetch;

      const { org, template, contact } = await setupCustomHttpManualSendOrg({
        fetchImpl: fetchMock,
      });

      const result = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      }, { createdByUserId: org.user.id });

      expect(result.queued.created).toBe(1);
      expect(fetchMock).not.toHaveBeenCalled();

      const sent = await sendQueueItem(
        org.organization.id,
        result.creation.queueIds[0]!,
      );
      expect(sent.status).toBe("sent");
      expect(fetchMock).toHaveBeenCalled();

      await cleanupOrganization(org.organization.id);
    });

    it("does not call CUSTOM_HTTP provider for non-ready templates", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const { org, template, contact } = await setupManualSendOrg({
        configureCustomHttp: true,
        configureDlt: false,
      });

      await expect(
        executeManualSend(org.organization.id, {
          templateId: template.id,
          contactIds: [contact.id],
        }, { createdByUserId: org.user.id }),
      ).rejects.toBeInstanceOf(QueueTemplateRejectedError);

      expect(fetchMock).not.toHaveBeenCalled();

      await cleanupOrganization(org.organization.id);
    });

    it("leaves created queues PENDING for workers after enqueue", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const { org, template, contact } = await setupManualSendOrg();
      const result = await executeManualSend(org.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      }, { createdByUserId: org.user.id });

      expect(result.creation.created).toBe(1);
      expect(result.queued.created).toBe(1);
      expect(result).not.toHaveProperty("send");

      const queue = await prisma.sendQueue.findFirst({
        where: {
          organizationId: org.organization.id,
          id: result.creation.queueIds[0],
        },
      });
      expect(queue?.status).toBe("PENDING");

      await cleanupOrganization(org.organization.id);
    });
  });

  describe("tenant isolation", () => {
    it("rejects foreign template without existence leak", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const orgA = await setupManualSendOrg();
      const orgB = await setupManualSendOrg();

      await expect(
        executeManualSend(orgB.org.organization.id, {
          templateId: orgA.template.id,
          contactIds: [orgB.contact.id],
        }, { createdByUserId: orgB.org.user.id }),
      ).rejects.toBeInstanceOf(QueueTemplateNotFoundError);

      await cleanupOrganization(orgA.org.organization.id);
      await cleanupOrganization(orgB.org.organization.id);
    });

    it("rejects mixed tenant contacts without foreign queue rows", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const orgA = await setupManualSendOrg();
      const orgB = await setupManualSendOrg();

      await expect(
        executeManualSend(orgA.org.organization.id, {
          templateId: orgA.template.id,
          contactIds: [orgA.contact.id, orgB.contact.id],
        }, { createdByUserId: orgA.org.user.id }),
      ).rejects.toBeInstanceOf(QueueValidationError);

      const queueCount = await prisma.sendQueue.count({
        where: { organizationId: orgB.org.organization.id },
      });
      expect(queueCount).toBe(0);

      await cleanupOrganization(orgA.org.organization.id);
      await cleanupOrganization(orgB.org.organization.id);
    });

    it("does not reserve usage for rejected cross-tenant requests", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const orgA = await setupManualSendOrg();
      const orgB = await setupManualSendOrg();
      const before = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: orgB.org.organization.id },
      });

      await expect(
        executeManualSend(orgB.org.organization.id, {
          templateId: orgA.template.id,
          contactIds: [orgB.contact.id],
        }, { createdByUserId: orgB.org.user.id }),
      ).rejects.toBeInstanceOf(QueueTemplateNotFoundError);

      const after = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: orgB.org.organization.id },
      });
      expect(after.messagesSentThisMonth).toBe(before.messagesSentThisMonth);

      await cleanupOrganization(orgA.org.organization.id);
      await cleanupOrganization(orgB.org.organization.id);
    });
  });

  describe("validation schema", () => {
    it("rejects unknown fields", () => {
      const parsed = manualSendRequestSchema.safeParse({
        templateId: "template-1",
        contactIds: ["contact-1"],
        organizationId: "other-org",
      });

      expect(parsed.success).toBe(false);
    });

    it("rejects more than 50 recipients", () => {
      const parsed = manualSendRequestSchema.safeParse({
        templateId: "template-1",
        contactIds: Array.from({ length: 51 }, (_, index) => `contact-${index}`),
      });

      expect(parsed.success).toBe(false);
    });

    it("accepts an optional clientOperationId UUID", () => {
      const parsed = manualSendRequestSchema.safeParse({
        templateId: "template-1",
        contactIds: ["contact-1"],
        clientOperationId: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(parsed.success).toBe(true);
    });

    it("rejects a non-UUID clientOperationId", () => {
      const parsed = manualSendRequestSchema.safeParse({
        templateId: "template-1",
        contactIds: ["contact-1"],
        clientOperationId: "not-a-uuid",
      });

      expect(parsed.success).toBe(false);
    });

    it("deduplicates contact IDs in helper", () => {
      expect(dedupeContactIds(["a", "b", "a"])).toEqual(["a", "b"]);
    });
  });
});
