import { Channel, ChannelProvider } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { createDocumentTemplate } from "@/lib/document-templates/service";
import { saveLayout } from "@/lib/document-templates/layout.service";
import { prisma } from "@/lib/db";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { claimQueueItemsForOrganization } from "@/lib/queue/claim";
import { executeManualSend } from "@/lib/queue/manual-send";
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

function uniqueEmail(prefix: string) {
  return `${prefix}-${uniqueSuffix()}@example.com`;
}

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
    organizationName: `Manual Send Doc Org ${suffix}`,
    organizationSlug: `manual-send-doc-org-${suffix}`,
    timezone: "UTC",
    adminName: "Manual Send Doc Admin",
    email: `manual-send-doc-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
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

/**
 * Org + an EMAIL TEST channel config (deterministic, no live Resend call)
 * + a system Birthday occasion (only needed to satisfy MessageTemplate's
 * required occasionId FK - Manual Send itself never checks occasion-date
 * eligibility, unlike scheduled generation).
 */
async function setupManualSendEmailOrg() {
  const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
  await prisma.channelConfig.create({
    data: {
      organizationId: org.organization.id,
      channel: Channel.EMAIL,
      provider: ChannelProvider.TEST,
      encryptedCredentials: "test-credentials",
      isActive: true,
    },
  });
  const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
  return { org, birthday };
}

async function createEmailTemplate(
  organizationId: string,
  occasionId: string,
  templateOverrides: Record<string, unknown> = {},
) {
  return createTemplate(organizationId, {
    name: `Manual Email ${uniqueSuffix()}`,
    occasionId,
    channel: "EMAIL" as const,
    body: "Happy Birthday {{name}}!",
    emailSubject: "Happy Birthday!",
    isActive: true,
    ...templateOverrides,
  });
}

describe("Manual Send: personalized PDF delivery", () => {
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

  it("leaves manual-send queue creation unchanged for a template without a PDF (existing behavior)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await setupManualSendEmailOrg();
    const template = await createEmailTemplate(org.organization.id, birthday.id);
    const contact = await createContact(org.organization.id, {
      name: "Ishika",
      mobile: uniqueMobile(),
      email: uniqueEmail("contact"),
      isActive: true,
    });

    const result = await executeManualSend(
      org.organization.id,
      { templateId: template.id, contactIds: [contact.id] },
      { createdByUserId: org.user.id },
    );
    expect(result.creation.created).toBe(1);

    const queue = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, contactId: contact.id },
    });
    expect(queue.status).toBe("PENDING");
    expect(queue.generatedDocumentId).toBeNull();

    const documentCount = await prisma.generatedDocument.count({
      where: { organizationId: org.organization.id },
    });
    expect(documentCount).toBe(0);

    await cleanupOrganization(org.organization.id);
  });

  it("generates a GeneratedDocument and links it to the SendQueue row, attributed to the actor who sent it", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await setupManualSendEmailOrg();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const template = await createEmailTemplate(org.organization.id, birthday.id, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    const contact = await createContact(org.organization.id, {
      name: "Ishika",
      mobile: uniqueMobile(),
      email: uniqueEmail("contact"),
      isActive: true,
    });

    const result = await executeManualSend(
      org.organization.id,
      { templateId: template.id, contactIds: [contact.id] },
      { createdByUserId: org.user.id },
    );
    expect(result.creation.created).toBe(1);

    const queue = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, contactId: contact.id },
    });
    expect(queue.status).toBe("PENDING");
    expect(queue.generatedDocumentId).not.toBeNull();
    expect(queue.renderedBody).toBe("Happy Birthday Ishika!");

    const generatedDocument = await prisma.generatedDocument.findUniqueOrThrow({
      where: { id: queue.generatedDocumentId! },
    });
    expect(generatedDocument.organizationId).toBe(org.organization.id);
    expect(generatedDocument.templateId).toBe(documentTemplate.id);
    // Attributed to the admin who actually clicked Send Now - not a
    // scheduled-automation "any org admin" fallback.
    expect(generatedDocument.createdByUserId).toBe(org.user.id);

    await cleanupOrganization(org.organization.id);
  });

  it("generates distinct, separately personalized GeneratedDocuments for multiple contacts in one manual send", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await setupManualSendEmailOrg();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const template = await createEmailTemplate(org.organization.id, birthday.id, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    const contactA = await createContact(org.organization.id, {
      name: "Alpha",
      mobile: uniqueMobile(),
      email: uniqueEmail("alpha"),
      isActive: true,
    });
    const contactB = await createContact(org.organization.id, {
      name: "Beta",
      mobile: uniqueMobile(),
      email: uniqueEmail("beta"),
      isActive: true,
    });

    const result = await executeManualSend(
      org.organization.id,
      { templateId: template.id, contactIds: [contactA.id, contactB.id] },
      { createdByUserId: org.user.id },
    );
    expect(result.creation.created).toBe(2);

    const queueRows = await prisma.sendQueue.findMany({
      where: { organizationId: org.organization.id, templateId: template.id },
    });
    expect(queueRows).toHaveLength(2);
    expect(queueRows.every((row) => row.generatedDocumentId)).toBe(true);

    const documentIds = queueRows.map((row) => row.generatedDocumentId!);
    expect(new Set(documentIds).size).toBe(2);

    const rowA = queueRows.find((row) => row.contactId === contactA.id)!;
    const rowB = queueRows.find((row) => row.contactId === contactB.id)!;
    expect(rowA.renderedBody).toBe("Happy Birthday Alpha!");
    expect(rowB.renderedBody).toBe("Happy Birthday Beta!");

    await cleanupOrganization(org.organization.id);
  });

  it("generates a personalized PDF for an ad-hoc Quick List recipient with no Contact row", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await setupManualSendEmailOrg();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const template = await createEmailTemplate(org.organization.id, birthday.id, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });

    const result = await executeManualSend(
      org.organization.id,
      {
        templateId: template.id,
        recipients: [
          { name: "Quick Guest", mobile: uniqueMobile(), email: uniqueEmail("quick") },
        ],
      },
      { createdByUserId: org.user.id },
    );
    expect(result.creation.created).toBe(1);

    const queue = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, templateId: template.id },
    });
    expect(queue.contactId).toBeNull();
    expect(queue.generatedDocumentId).not.toBeNull();
    expect(queue.renderedBody).toBe("Happy Birthday Quick Guest!");

    await cleanupOrganization(org.organization.id);
  });

  it("fails the queue row safely (without crashing the send) when includePersonalizedPdf is true but documentTemplateId is null", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await setupManualSendEmailOrg();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const template = await createEmailTemplate(org.organization.id, birthday.id, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    // Simulate the ON DELETE SET NULL edge case directly, same convention
    // used by the scheduled-flow equivalent test.
    await prisma.messageTemplate.update({
      where: { id: template.id },
      data: { documentTemplateId: null },
    });
    const contact = await createContact(org.organization.id, {
      name: "Ishika",
      mobile: uniqueMobile(),
      email: uniqueEmail("contact"),
      isActive: true,
    });

    const result = await executeManualSend(
      org.organization.id,
      { templateId: template.id, contactIds: [contact.id] },
      { createdByUserId: org.user.id },
    );
    // The queue row is still created (message personalization is
    // independent of the PDF) - it just can't be considered ready to send.
    expect(result.creation.created).toBe(1);

    const queue = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, contactId: contact.id },
    });
    expect(queue.status).toBe("FAILED");
    expect(queue.lastErrorCode).toBe("DOCUMENT_TEMPLATE_MISSING");
    expect(queue.generatedDocumentId).toBeNull();

    await cleanupOrganization(org.organization.id);
  });

  it("isolates a PDF generation failure for one recipient from another recipient in the same manual send", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await setupManualSendEmailOrg();
    // Deliberately skip saveLayout - PDF generation rejects a
    // DocumentTemplate with no saved layout, failing every recipient
    // sharing this template/document-template pair.
    const bytes = await createTestPdfBytes();
    const documentTemplate = await createDocumentTemplate(
      org.organization.id,
      org.user.id,
      {
        name: "Layout-less template",
        file: { bytes, filename: "template.pdf", contentType: "application/pdf" },
      },
    );
    const template = await createEmailTemplate(org.organization.id, birthday.id, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    const contactA = await createContact(org.organization.id, {
      name: "Contact One",
      mobile: uniqueMobile(),
      email: uniqueEmail("one"),
      isActive: true,
    });
    const contactB = await createContact(org.organization.id, {
      name: "Contact Two",
      mobile: uniqueMobile(),
      email: uniqueEmail("two"),
      isActive: true,
    });

    const result = await executeManualSend(
      org.organization.id,
      { templateId: template.id, contactIds: [contactA.id, contactB.id] },
      { createdByUserId: org.user.id },
    );
    // Both rows were created independently - one recipient's document
    // failure never blocked the other's row from being created.
    expect(result.creation.created).toBe(2);

    const queueRows = await prisma.sendQueue.findMany({
      where: { organizationId: org.organization.id, templateId: template.id },
    });
    expect(queueRows).toHaveLength(2);
    for (const row of queueRows) {
      expect(row.status).toBe("FAILED");
      expect(row.lastErrorCode).toBe("DOCUMENT_GENERATION_FAILED");
    }

    await cleanupOrganization(org.organization.id);
  });

  it("delivers the Email with the personalized PDF attached", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await setupManualSendEmailOrg();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const template = await createEmailTemplate(org.organization.id, birthday.id, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    const contact = await createContact(org.organization.id, {
      name: "Ishika",
      mobile: uniqueMobile(),
      email: uniqueEmail("contact"),
      isActive: true,
    });

    await executeManualSend(
      org.organization.id,
      { templateId: template.id, contactIds: [contact.id] },
      { createdByUserId: org.user.id },
    );
    const queue = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, contactId: contact.id },
    });

    const result = await sendQueueItem(org.organization.id, queue.id, "send");
    expect(result.status).toBe("sent");
    expect(result.queue?.status).toBe("SENT");

    await cleanupOrganization(org.organization.id);
  });

  it("reuses the same GeneratedDocument on retry after a transient storage failure, without regenerating the PDF", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await setupManualSendEmailOrg();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const template = await createEmailTemplate(org.organization.id, birthday.id, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    const contact = await createContact(org.organization.id, {
      name: "Ishika",
      mobile: uniqueMobile(),
      email: uniqueEmail("contact"),
      isActive: true,
    });

    await executeManualSend(
      org.organization.id,
      { templateId: template.id, contactIds: [contact.id] },
      { createdByUserId: org.user.id },
    );
    const queue = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, contactId: contact.id },
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

  it("prepares the missing PDF on Retry after a row failed with DOCUMENT_NOT_READY, then delivers it", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await setupManualSendEmailOrg();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const template = await createEmailTemplate(org.organization.id, birthday.id, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    const contact = await createContact(org.organization.id, {
      name: "Bhakti",
      mobile: uniqueMobile(),
      email: uniqueEmail("contact"),
      isActive: true,
    });

    await executeManualSend(
      org.organization.id,
      { templateId: template.id, contactIds: [contact.id] },
      { createdByUserId: org.user.id },
    );
    const queue = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, contactId: contact.id },
    });

    // Recreate the race: the worker failed the row before its PDF was attached.
    await prisma.sendQueue.update({
      where: { id: queue.id },
      data: {
        generatedDocumentId: null,
        status: "FAILED",
        lastError: "Personalized PDF has not been prepared for this delivery yet",
        lastErrorCode: "DOCUMENT_NOT_READY",
        attemptCount: 1,
        nextAttemptAt: null,
      },
    });
    await prisma.generatedDocument.deleteMany({
      where: { organizationId: org.organization.id },
    });

    await scheduleQueueRetry(org.organization.id, queue.id);
    const afterRetry = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(afterRetry.generatedDocumentId).not.toBeNull();

    const claimed = await claimQueueItemsForOrganization(org.organization.id);
    expect(claimed.map((item) => item.id)).toContain(queue.id);
    const result = await processClaimedQueueItem(org.organization.id, queue.id);
    expect(result.status).toBe("sent");

    await cleanupOrganization(org.organization.id);
  });

  it("refuses Retry with a clear reason when the PDF cannot be prepared (no document template)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await setupManualSendEmailOrg();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const template = await createEmailTemplate(org.organization.id, birthday.id, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    const contact = await createContact(org.organization.id, {
      name: "Bhakti",
      mobile: uniqueMobile(),
      email: uniqueEmail("contact"),
      isActive: true,
    });
    await executeManualSend(
      org.organization.id,
      { templateId: template.id, contactIds: [contact.id] },
      { createdByUserId: org.user.id },
    );
    const queue = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, contactId: contact.id },
    });
    await prisma.sendQueue.update({
      where: { id: queue.id },
      data: {
        generatedDocumentId: null,
        status: "FAILED",
        lastErrorCode: "DOCUMENT_NOT_READY",
        nextAttemptAt: null,
      },
    });
    await prisma.messageTemplate.update({
      where: { id: template.id },
      data: { documentTemplateId: null },
    });

    await expect(
      scheduleQueueRetry(org.organization.id, queue.id),
    ).rejects.toThrow(/no document template is configured/i);

    await cleanupOrganization(org.organization.id);
  });

  it("does not generate a second GeneratedDocument when the same clientOperationId is replayed", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await setupManualSendEmailOrg();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const template = await createEmailTemplate(org.organization.id, birthday.id, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    const contact = await createContact(org.organization.id, {
      name: "Ishika",
      mobile: uniqueMobile(),
      email: uniqueEmail("contact"),
      isActive: true,
    });
    const clientOperationId = crypto.randomUUID();

    const first = await executeManualSend(
      org.organization.id,
      { templateId: template.id, contactIds: [contact.id], clientOperationId },
      { createdByUserId: org.user.id },
    );
    const second = await executeManualSend(
      org.organization.id,
      { templateId: template.id, contactIds: [contact.id], clientOperationId },
      { createdByUserId: org.user.id },
    );

    expect(first.creation.queueIds).toEqual(second.creation.queueIds);

    const documentCount = await prisma.generatedDocument.count({
      where: { organizationId: org.organization.id },
    });
    expect(documentCount).toBe(1);

    await cleanupOrganization(org.organization.id);
  });

  it("delivers WhatsApp with the personalized PDF attached (reuses the exact same document-delivery mechanism as Email)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    await prisma.channelConfig.create({
      data: {
        organizationId: org.organization.id,
        channel: Channel.WHATSAPP,
        provider: ChannelProvider.TEST,
        encryptedCredentials: "test-credentials",
        isActive: true,
      },
    });
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const template = await createTemplate(org.organization.id, {
      name: `Manual WhatsApp ${uniqueSuffix()}`,
      occasionId: birthday.id,
      channel: "WHATSAPP" as const,
      body: "Happy Birthday {{name}}!",
      whatsappTemplateName: "birthday",
      whatsappLanguage: "en",
      isActive: true,
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    const contact = await createContact(org.organization.id, {
      name: "Sagar",
      mobile: uniqueMobile(),
      isActive: true,
    });

    const result = await executeManualSend(
      org.organization.id,
      { templateId: template.id, contactIds: [contact.id] },
      { createdByUserId: org.user.id },
    );
    expect(result.creation.created).toBe(1);

    const queue = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, contactId: contact.id },
    });
    expect(queue.generatedDocumentId).not.toBeNull();

    const sendResult = await sendQueueItem(org.organization.id, queue.id, "send");
    expect(sendResult.status).toBe("sent");

    await cleanupOrganization(org.organization.id);
  });
});
