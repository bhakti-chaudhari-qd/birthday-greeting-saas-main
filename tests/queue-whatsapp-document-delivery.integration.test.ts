import { Channel, ChannelProvider } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { createDocumentTemplate } from "@/lib/document-templates/service";
import { saveLayout } from "@/lib/document-templates/layout.service";
import { prisma } from "@/lib/db";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { generateOccasionQueue } from "@/lib/queue/generate";
import { claimQueueItemsForOrganization } from "@/lib/queue/claim";
import {
  processClaimedQueueItem,
  scheduleQueueRetry,
  sendQueueItem,
} from "@/lib/queue/send";
import { createTemplate } from "@/lib/templates/service";
import type { DocumentStorage } from "@/lib/storage";
import { DocumentStorageOperationError } from "@/lib/storage/errors";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function uniqueMobile() {
  return `9${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
}

async function createTestPdfBytes(): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([612, 792]);
  return Buffer.from(await pdfDoc.save());
}

function registerInput(suffix: string) {
  return {
    organizationName: `WA Doc Delivery Org ${suffix}`,
    organizationSlug: `wa-doc-delivery-org-${suffix}`,
    timezone: "UTC",
    adminName: "WA Doc Delivery Admin",
    email: `wa-doc-delivery-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

async function createOrgWithBirthday() {
  const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
  const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
  return { org, birthday };
}

async function createDocumentTemplateFixture(
  organizationId: string,
  userId: string,
) {
  const bytes = await createTestPdfBytes();
  const documentTemplate = await createDocumentTemplate(organizationId, userId, {
    name: "Birthday Greeting PDF",
    file: { bytes, filename: "template.pdf", contentType: "application/pdf" },
  });
  await saveLayout(organizationId, documentTemplate.id, {
    elements: [
      {
        id: "el-1",
        type: "text",
        x: 0.1,
        y: 0.1,
        width: 0.6,
        text: "Happy Birthday {{name}}!",
        fontSize: 16,
        color: "#000000",
      },
    ],
  });
  return documentTemplate;
}

/**
 * Sets up one WHATSAPP automation delivery end to end (MessageTemplate ->
 * CategoryAutomationRule -> Contact -> generateOccasionQueue), reusing the
 * real Step 1/Step 2 code paths - the same fixture shape as the Email Step 3
 * suite, adapted for WhatsApp's required template metadata (templateName,
 * language). TEST channel provider keeps sends deterministic (no live HTTP).
 */
async function setupWhatsAppQueueItem(
  org: Awaited<ReturnType<typeof createRegisteredOrganization>>,
  birthday: { id: string },
  templateOverrides: Record<string, unknown> = {},
  contactName = "Sagar",
) {
  await prisma.channelConfig.create({
    data: {
      organizationId: org.organization.id,
      channel: Channel.WHATSAPP,
      provider: ChannelProvider.TEST,
      encryptedCredentials: "test-credentials",
      isActive: true,
    },
  });

  const template = await createTemplate(org.organization.id, {
    name: `Birthday WhatsApp ${uniqueSuffix()}`,
    occasionId: birthday.id,
    channel: "WHATSAPP" as const,
    body: "Happy Birthday {{name}}!",
    whatsappTemplateName: "birthday",
    whatsappLanguage: "en",
    isActive: true,
    ...templateOverrides,
  });
  await prisma.categoryAutomationRule.create({
    data: {
      organizationId: org.organization.id,
      occasionId: birthday.id,
      categoryId: null,
      sendHour: 0,
      sendMinute: 0,
      whatsappEnabled: true,
      whatsappTemplateId: template.id,
    },
  });
  const contact = await createContact(org.organization.id, {
    name: contactName,
    mobile: uniqueMobile(),
    occasionDates: { [birthday.id]: "1990-07-11" },
    isActive: true,
  });

  const summary = await generateOccasionQueue(org.organization.id, birthday.id, {
    templateId: template.id,
    targetDate: "2026-07-11",
  });
  expect(summary.created).toBe(1);

  const queue = await prisma.sendQueue.findFirstOrThrow({
    where: { organizationId: org.organization.id, contactId: contact.id },
  });

  return { template, contact, queue };
}

function createFailingStorage(): DocumentStorage {
  return {
    async upload() {
      throw new Error("upload should not be called by the worker send path");
    },
    async download() {
      throw new DocumentStorageOperationError("download");
    },
    async delete() {
      throw new Error("delete should not be called by the worker send path");
    },
  };
}

describe("WhatsApp delivery of personalized PDFs", () => {
  beforeAll(async () => {
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

  it("sends a normal WhatsApp template unchanged when it has no personalized PDF", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await createOrgWithBirthday();
    const { queue } = await setupWhatsAppQueueItem(org, birthday);
    expect(queue.generatedDocumentId).toBeNull();

    const result = await sendQueueItem(org.organization.id, queue.id);

    expect(result.status).toBe("sent");
    expect(result.queue?.status).toBe("SENT");

    await cleanupOrganization(org.organization.id);
  });

  it("retrieves the prepared GeneratedDocument and sends the WhatsApp template with it attached, without regenerating it", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await createOrgWithBirthday();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const { queue } = await setupWhatsAppQueueItem(org, birthday, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    expect(queue.generatedDocumentId).not.toBeNull();
    const generatedDocumentId = queue.generatedDocumentId!;

    const result = await sendQueueItem(org.organization.id, queue.id);

    expect(result.status).toBe("sent");
    expect(result.queue?.status).toBe("SENT");

    // The worker never regenerates - same GeneratedDocument, still exactly one.
    const documentCount = await prisma.generatedDocument.count({
      where: { organizationId: org.organization.id },
    });
    expect(documentCount).toBe(1);
    const reloadedQueue = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(reloadedQueue.generatedDocumentId).toBe(generatedDocumentId);

    await cleanupOrganization(org.organization.id);
  });

  it("does not send when a personalized PDF is required but generatedDocumentId is missing (crash-before-prepared scenario)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await createOrgWithBirthday();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const { queue } = await setupWhatsAppQueueItem(org, birthday, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    expect(queue.generatedDocumentId).not.toBeNull();

    await prisma.sendQueue.update({
      where: { id: queue.id },
      data: { generatedDocumentId: null },
    });

    const result = await sendQueueItem(org.organization.id, queue.id);

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("DOCUMENT_NOT_READY");
    expect(result.queue?.status).toBe("FAILED");

    await cleanupOrganization(org.organization.id);
  });

  it("does not send when the prepared GeneratedDocument has expired", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await createOrgWithBirthday();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const { queue } = await setupWhatsAppQueueItem(org, birthday, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    const generatedDocumentId = queue.generatedDocumentId!;

    await prisma.generatedDocument.update({
      where: { id: generatedDocumentId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await sendQueueItem(org.organization.id, queue.id);

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("DOCUMENT_EXPIRED");
    expect(result.queue?.status).toBe("FAILED");

    await cleanupOrganization(org.organization.id);
  });

  it("does not send when the SendQueue row references another organization's GeneratedDocument (org isolation)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org: orgA, birthday: birthdayA } = await createOrgWithBirthday();
    const { org: orgB, birthday: birthdayB } = await createOrgWithBirthday();

    const documentTemplateA = await createDocumentTemplateFixture(
      orgA.organization.id,
      orgA.user.id,
    );
    const documentTemplateB = await createDocumentTemplateFixture(
      orgB.organization.id,
      orgB.user.id,
    );

    const { queue: queueA } = await setupWhatsAppQueueItem(orgA, birthdayA, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplateA.id,
    });
    const { queue: queueB } = await setupWhatsAppQueueItem(orgB, birthdayB, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplateB.id,
    });

    await prisma.sendQueue.update({
      where: { id: queueA.id },
      data: { generatedDocumentId: queueB.generatedDocumentId },
    });

    const result = await sendQueueItem(orgA.organization.id, queueA.id);

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("DOCUMENT_NOT_FOUND");
    expect(result.queue?.status).toBe("FAILED");

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("does not send when document storage is unavailable, and schedules a retry instead of failing terminally", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await createOrgWithBirthday();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const { queue } = await setupWhatsAppQueueItem(org, birthday, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });

    const result = await sendQueueItem(org.organization.id, queue.id, "send", {
      storage: createFailingStorage(),
    });

    expect(result.status).toBe("retry_scheduled");
    expect(result.errorCode).toBe("DOCUMENT_STORAGE_UNAVAILABLE");
    expect(result.queue?.status).toBe("FAILED");
    expect(result.queue?.nextAttemptAt).not.toBeNull();

    await cleanupOrganization(org.organization.id);
  });

  it("reuses the same GeneratedDocument on retry after a transient storage failure, without regenerating the PDF", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await createOrgWithBirthday();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const { queue } = await setupWhatsAppQueueItem(org, birthday, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    const generatedDocumentId = queue.generatedDocumentId!;

    const attempt1 = await sendQueueItem(org.organization.id, queue.id, "send", {
      storage: createFailingStorage(),
    });
    expect(attempt1.status).toBe("retry_scheduled");
    expect(attempt1.queue?.attemptCount).toBe(1);

    await scheduleQueueRetry(org.organization.id, queue.id);
    const claimed = await claimQueueItemsForOrganization(org.organization.id);
    expect(claimed.map((item) => item.id)).toContain(queue.id);

    const attempt2 = await processClaimedQueueItem(org.organization.id, queue.id);

    expect(attempt2.status).toBe("sent");
    expect(attempt2.queue?.status).toBe("SENT");
    expect(attempt2.queue?.attemptCount).toBe(2);

    const documentCount = await prisma.generatedDocument.count({
      where: { organizationId: org.organization.id },
    });
    expect(documentCount).toBe(1);
    const reloadedQueue = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(reloadedQueue.generatedDocumentId).toBe(generatedDocumentId);

    await cleanupOrganization(org.organization.id);
  });

  it("does not generate a second GeneratedDocument or send twice when automation is re-run for the same contact/date (idempotency)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await createOrgWithBirthday();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const { template } = await setupWhatsAppQueueItem(org, birthday, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });

    const rerun = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });
    expect(rerun.created).toBe(0);
    expect(rerun.skippedDuplicate).toBe(1);

    const documentCount = await prisma.generatedDocument.count({
      where: { organizationId: org.organization.id },
    });
    expect(documentCount).toBe(1);

    await cleanupOrganization(org.organization.id);
  });

  it("falls back to the existing image/video WhatsApp media when no personalized PDF is configured", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await createOrgWithBirthday();

    await prisma.channelConfig.create({
      data: {
        organizationId: org.organization.id,
        channel: Channel.WHATSAPP,
        provider: ChannelProvider.TEST,
        encryptedCredentials: "test-credentials",
        isActive: true,
      },
    });

    const mediaAsset = await prisma.whatsAppMediaAsset.create({
      data: {
        organizationId: org.organization.id,
        bytes: Buffer.from("fake-jpeg-bytes"),
        filename: "greeting.jpg",
        contentType: "image/jpeg",
        byteLength: 15,
        checksum: "fake-checksum",
      },
    });

    const template = await createTemplate(org.organization.id, {
      name: `Birthday WhatsApp Media ${uniqueSuffix()}`,
      occasionId: birthday.id,
      channel: "WHATSAPP" as const,
      body: "Happy Birthday {{name}}!",
      whatsappTemplateName: "birthday",
      whatsappLanguage: "en",
      whatsappMediaAssetId: mediaAsset.id,
      isActive: true,
    });
    await prisma.categoryAutomationRule.create({
      data: {
        organizationId: org.organization.id,
        occasionId: birthday.id,
        categoryId: null,
        sendHour: 0,
        sendMinute: 0,
        whatsappEnabled: true,
        whatsappTemplateId: template.id,
      },
    });
    const contact = await createContact(org.organization.id, {
      name: "Priya",
      mobile: uniqueMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      isActive: true,
    });

    await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });
    const queue = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, contactId: contact.id },
    });
    expect(queue.generatedDocumentId).toBeNull();
    expect(queue.whatsappMediaAssetId).toBe(mediaAsset.id);

    const result = await sendQueueItem(org.organization.id, queue.id);

    expect(result.status).toBe("sent");
    expect(result.queue?.status).toBe("SENT");

    await cleanupOrganization(org.organization.id);
  });

  it("isolates a PDF failure for one contact from other contacts' WhatsApp deliveries in the same batch", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await createOrgWithBirthday();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );

    await prisma.channelConfig.create({
      data: {
        organizationId: org.organization.id,
        channel: Channel.WHATSAPP,
        provider: ChannelProvider.TEST,
        encryptedCredentials: "test-credentials",
        isActive: true,
      },
    });

    const template = await createTemplate(org.organization.id, {
      name: `Birthday WhatsApp Batch ${uniqueSuffix()}`,
      occasionId: birthday.id,
      channel: "WHATSAPP" as const,
      body: "Happy Birthday {{name}}!",
      whatsappTemplateName: "birthday",
      whatsappLanguage: "en",
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
      isActive: true,
    });
    await prisma.categoryAutomationRule.create({
      data: {
        organizationId: org.organization.id,
        occasionId: birthday.id,
        categoryId: null,
        sendHour: 0,
        sendMinute: 0,
        whatsappEnabled: true,
        whatsappTemplateId: template.id,
      },
    });

    const sagar = await createContact(org.organization.id, {
      name: "Sagar",
      mobile: uniqueMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      isActive: true,
    });
    const rahul = await createContact(org.organization.id, {
      name: "Rahul",
      mobile: uniqueMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      isActive: true,
    });
    const priya = await createContact(org.organization.id, {
      name: "Priya",
      mobile: uniqueMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      isActive: true,
    });

    await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });

    const queueSagar = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, contactId: sagar.id },
    });
    const queueRahul = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, contactId: rahul.id },
    });
    const queuePriya = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, contactId: priya.id },
    });

    // Rahul's PDF retrieval will fail - simulate expiry for his document only.
    await prisma.generatedDocument.update({
      where: { id: queueRahul.generatedDocumentId! },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const resultSagar = await sendQueueItem(org.organization.id, queueSagar.id);
    const resultRahul = await sendQueueItem(org.organization.id, queueRahul.id);
    const resultPriya = await sendQueueItem(org.organization.id, queuePriya.id);

    expect(resultSagar.status).toBe("sent");
    expect(resultRahul.status).toBe("failed");
    expect(resultRahul.errorCode).toBe("DOCUMENT_EXPIRED");
    expect(resultPriya.status).toBe("sent");

    await cleanupOrganization(org.organization.id);
  });
});
