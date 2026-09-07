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
    organizationName: `Queue Delivery Org ${suffix}`,
    organizationSlug: `queue-delivery-org-${suffix}`,
    timezone: "UTC",
    adminName: "Queue Delivery Admin",
    email: `queue-delivery-admin-${suffix}@test.local`,
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
 * Sets up one EMAIL automation delivery end to end (MessageTemplate ->
 * CategoryAutomationRule -> Contact -> generateOccasionQueue), reusing the
 * real Step 1/Step 2 code paths so the resulting SendQueue row is exactly
 * what production would produce - including a real GeneratedDocument in
 * real B2 when templateOverrides configures a personalized PDF.
 */
async function setupEmailQueueItem(
  org: Awaited<ReturnType<typeof createRegisteredOrganization>>,
  birthday: { id: string },
  templateOverrides: Record<string, unknown> = {},
) {
  // Force the deterministic TEST provider instead of the real Resend
  // provider the factory otherwise defaults EMAIL to - RESEND_API_KEY is
  // configured in this environment, and Resend's sandbox sender rejects
  // arbitrary recipient addresses, which is unrelated to what these tests
  // are verifying (PDF attachment wiring, not real Resend delivery).
  await prisma.channelConfig.create({
    data: {
      organizationId: org.organization.id,
      channel: Channel.EMAIL,
      provider: ChannelProvider.TEST,
      encryptedCredentials: "test-credentials",
      isActive: true,
    },
  });

  const template = await createTemplate(org.organization.id, {
    name: `Birthday Email ${uniqueSuffix()}`,
    occasionId: birthday.id,
    channel: "EMAIL" as const,
    body: "Happy Birthday {{name}}!",
    emailSubject: "Happy Birthday!",
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
      emailEnabled: true,
      emailTemplateId: template.id,
    },
  });
  const contact = await createContact(org.organization.id, {
    name: "Ishika",
    mobile: uniqueMobile(),
    email: uniqueEmail("contact"),
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

describe("email delivery of personalized PDFs (Step 3)", () => {
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

  it("sends a normal email unchanged when the template has no personalized PDF", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await createOrgWithBirthday();
    const { queue } = await setupEmailQueueItem(org, birthday);
    expect(queue.generatedDocumentId).toBeNull();

    const result = await sendQueueItem(org.organization.id, queue.id);

    expect(result.status).toBe("sent");
    expect(result.queue?.status).toBe("SENT");

    await cleanupOrganization(org.organization.id);
  });

  it("retrieves the prepared GeneratedDocument and sends the email with it attached, without regenerating it", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday } = await createOrgWithBirthday();
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const { queue } = await setupEmailQueueItem(org, birthday, {
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
    const { queue } = await setupEmailQueueItem(org, birthday, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    expect(queue.generatedDocumentId).not.toBeNull();

    // Simulate a process crash between the transaction commit and Step 2's
    // post-transaction document-preparation loop finishing: the row is
    // still PENDING, but no GeneratedDocument was ever linked.
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
    const { queue } = await setupEmailQueueItem(org, birthday, {
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

    // No regeneration attempt happened - same document row, still expired.
    const stillExpired = await prisma.generatedDocument.findUniqueOrThrow({
      where: { id: generatedDocumentId },
    });
    expect(stillExpired.expiresAt.getTime()).toBeLessThan(Date.now());

    await cleanupOrganization(org.organization.id);
  });

  it("does not send when the SendQueue row references another organization's GeneratedDocument (org isolation)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org: orgA, birthday: birthdayA } = await createOrgWithBirthday();
    const { org: orgB, birthday: birthdayB } = await createOrgWithBirthday();
    void birthdayB;

    const documentTemplateA = await createDocumentTemplateFixture(
      orgA.organization.id,
      orgA.user.id,
    );
    const documentTemplateB = await createDocumentTemplateFixture(
      orgB.organization.id,
      orgB.user.id,
    );

    const { queue: queueA } = await setupEmailQueueItem(orgA, birthdayA, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplateA.id,
    });
    const { queue: queueB } = await setupEmailQueueItem(orgB, birthdayB, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplateB.id,
    });

    // Directly simulate a bug/attack: org A's queue row points at org B's
    // real, unexpired GeneratedDocument. The FK only requires the row to
    // exist somewhere - it does not enforce same-organization ownership,
    // so the worker's own org-scoped lookup is the only thing standing
    // between org A and org B's file.
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
    const { queue } = await setupEmailQueueItem(org, birthday, {
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
    const { queue } = await setupEmailQueueItem(org, birthday, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    const generatedDocumentId = queue.generatedDocumentId!;

    const attempt1 = await sendQueueItem(org.organization.id, queue.id, "send", {
      storage: createFailingStorage(),
    });
    expect(attempt1.status).toBe("retry_scheduled");
    expect(attempt1.queue?.attemptCount).toBe(1);

    // Reset nextAttemptAt to make it immediately claimable, same convention
    // used by the existing SMS retry test (bypasses waiting for backoff).
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
});
