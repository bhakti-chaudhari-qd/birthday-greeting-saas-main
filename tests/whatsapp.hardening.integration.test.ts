import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  Channel,
  ChannelProvider,
  Prisma,
  QueueStatus,
} from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { upsertWhatsAppChannelConfig } from "@/lib/channel-config/whatsapp-service";
import { prisma } from "@/lib/db";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { createTemplate, updateTemplate } from "@/lib/templates/service";
import { generateOccasionQueue } from "@/lib/queue/generate";
import { claimQueueItemsForOrganization } from "@/lib/queue/claim";
import { processClaimedQueueItem } from "@/lib/queue/send";
import {
  assertWhatsAppQueueSnapshots,
  parseWhatsAppParameterValuesSnapshot,
} from "@/lib/queue/whatsapp-snapshots";
import { QueueValidationError } from "@/lib/queue/errors";
import { testProvider } from "@/lib/messaging/providers/test-provider";
import { ProviderSendError } from "@/lib/messaging/providers/types";

import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `WA Harden Org ${suffix}`,
    organizationSlug: `wa-harden-org-${suffix}`,
    timezone: "UTC",
    adminName: "WA Harden Admin",
    email: `wa-harden-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("WhatsApp MVP hardening regressions", () => {
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

  it("rejects null/empty/malformed WhatsApp parameter snapshots before provider", () => {
    expect(() => parseWhatsAppParameterValuesSnapshot(null)).toThrow(
      QueueValidationError,
    );
    expect(() => parseWhatsAppParameterValuesSnapshot(undefined)).toThrow(
      QueueValidationError,
    );
    expect(() => parseWhatsAppParameterValuesSnapshot({})).toThrow(
      QueueValidationError,
    );
    expect(() => parseWhatsAppParameterValuesSnapshot("x")).toThrow(
      QueueValidationError,
    );
    expect(() => parseWhatsAppParameterValuesSnapshot([""])).toThrow(
      QueueValidationError,
    );
    expect(() => parseWhatsAppParameterValuesSnapshot(["  "])).toThrow(
      QueueValidationError,
    );
    expect(() => parseWhatsAppParameterValuesSnapshot([1])).toThrow(
      QueueValidationError,
    );
    expect(() => parseWhatsAppParameterValuesSnapshot([null])).toThrow(
      QueueValidationError,
    );
    expect(parseWhatsAppParameterValuesSnapshot([])).toEqual([]);
    expect(parseWhatsAppParameterValuesSnapshot(["Priya"])).toEqual(["Priya"]);

    expect(() =>
      assertWhatsAppQueueSnapshots({
        whatsappTemplateName: "hello",
        whatsappLanguage: "en",
        whatsappParameterValues: null,
      }),
    ).toThrow(QueueValidationError);
  });

  it("rejects malformed WhatsApp TEST provider parameter values", async () => {
    await expect(
      testProvider.send({
        channel: "WHATSAPP",
        recipient: "9876543999",
        templateName: "hello",
        language: "en",
        parameterValues: [""],
        renderedBody: "Hello",
        idempotencyKey: "bad-params",
        attemptNumber: 1,
      }),
    ).rejects.toBeInstanceOf(ProviderSendError);
  });

  it("birthday generate creates WhatsApp queue snapshots", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    try {
      const template = await createTemplate(org.organization.id, {
        name: "WA Birthday",
        occasionId: birthday.id,
        channel: Channel.WHATSAPP,
        body: "Happy Birthday {{name}}!",
        isActive: true,
        whatsappTemplateName: "birthday_wa",
        whatsappLanguage: "en",
      });
      const contact = await prisma.contact.create({
        data: {
          organizationId: org.organization.id,
          name: "Priya",
          mobile: testMobile(),
        },
      });
      await prisma.contactOccasionDate.create({
        data: {
          organizationId: org.organization.id,
          contactId: contact.id,
          occasionId: birthday.id,
          date: new Date(Date.UTC(2000, 6, 12)),
          month: 7,
          day: 12,
        },
      });

      const result = await generateOccasionQueue(org.organization.id, birthday.id, {
        templateId: template.id,
        targetDate: "2026-07-12",
      });
      expect(result.created).toBe(1);

      const queues = await prisma.sendQueue.findMany({
        where: { organizationId: org.organization.id },
      });
      expect(queues).toHaveLength(1);
      expect(queues[0]).toMatchObject({
        contactId: contact.id,
        channel: Channel.WHATSAPP,
        whatsappTemplateName: "birthday_wa",
        whatsappLanguage: "en",
        whatsappParameterValues: ["Priya"],
      });
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("fails malformed WhatsApp snapshots before providerAttemptStartedAt without reclaim loop", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const originalSend = testProvider.send;
    let providerCalls = 0;

    try {
      await upsertWhatsAppChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      const template = await createTemplate(org.organization.id, {
        name: "WA Snapshot",
        occasionId: birthday.id,
        channel: Channel.WHATSAPP,
        body: "Hello {{name}}",
        isActive: true,
        whatsappTemplateName: "snap_template",
        whatsappLanguage: "en",
      });

      const contact = await prisma.contact.create({
        data: {
          organizationId: org.organization.id,
          name: "Snap",
          mobile: "9876543112",
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
          templateId: template.id,
          channel: Channel.WHATSAPP,
          occasionId: birthday.id,
          scheduledDate: new Date("2026-07-12"),
          renderedBody: "Hello Snap",
          whatsappTemplateName: "snap_template",
          whatsappLanguage: "en",
          whatsappParameterValues: Prisma.DbNull,
          status: QueueStatus.PENDING,
          idempotencyKey: `wa-snap-${uniqueSuffix()}`,
        },
      });

      testProvider.send = async (...args) => {
        providerCalls += 1;
        return originalSend(...args);
      };

      const claimed = await claimQueueItemsForOrganization(org.organization.id, {
        limit: 25,
      });
      expect(claimed).toHaveLength(1);

      const result = await processClaimedQueueItem(
        org.organization.id,
        claimed[0]!.id,
      );

      expect(result.status).toBe("failed");
      expect(result.errorCode).toBe("INVALID_BODY");
      expect(providerCalls).toBe(0);

      const failed = await prisma.sendQueue.findUniqueOrThrow({
        where: { id: queue.id },
      });
      expect(failed.status).toBe(QueueStatus.FAILED);
      expect(failed.lastErrorCode).toBe("INVALID_BODY");
      expect(failed.providerAttemptStartedAt).toBeNull();
      expect(failed.attemptCount).toBe(0);

      const reclaim = await claimQueueItemsForOrganization(org.organization.id, {
        limit: 25,
      });
      expect(reclaim).toHaveLength(0);
    } finally {
      testProvider.send = originalSend;
      await cleanupOrganization(org.organization.id);
    }
  });

  it("clears stale DLT fields when a template switches to WhatsApp", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    try {
      const template = await createTemplate(org.organization.id, {
        name: "SMS then WA",
        occasionId: birthday.id,
        channel: Channel.SMS,
        body: "Hello {{name}}",
        isActive: true,
      });

      await prisma.messageTemplate.update({
        where: { id: template.id },
        data: {
          dltTemplateId: "DLT123",
          dltApprovedContent: "Hello {#var#}",
        },
      });

      const updated = await updateTemplate(org.organization.id, template.id, {
        channel: Channel.WHATSAPP,
        whatsappTemplateName: "switched_template",
        whatsappLanguage: "en",
      });

      expect(updated.channel).toBe(Channel.WHATSAPP);
      expect(updated.dltTemplateId).toBeNull();
      expect(updated.dltApprovedContent).toBeNull();
      expect(updated.whatsappTemplateName).toBe("switched_template");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("clears stale WhatsApp fields when a template switches to SMS", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    try {
      const template = await createTemplate(org.organization.id, {
        name: "WA then SMS",
        occasionId: birthday.id,
        channel: Channel.WHATSAPP,
        body: "Hello {{name}}",
        isActive: true,
        whatsappTemplateName: "wa_template",
        whatsappLanguage: "en",
      });

      const updated = await updateTemplate(org.organization.id, template.id, {
        channel: Channel.SMS,
      });

      expect(updated.channel).toBe(Channel.SMS);
      expect(updated.whatsappTemplateName).toBeNull();
      expect(updated.whatsappLanguage).toBeNull();
      expect(updated.whatsappParameterOrder).toEqual([]);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });
});
