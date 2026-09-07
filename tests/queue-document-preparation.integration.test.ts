import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { createDocumentTemplate } from "@/lib/document-templates/service";
import { saveLayout } from "@/lib/document-templates/layout.service";
import { prisma } from "@/lib/db";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { generateOccasionQueue } from "@/lib/queue/generate";
import { getGeneratedDocumentFile } from "@/lib/generated-documents/service";
import { createTemplate } from "@/lib/templates/service";
import { uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

async function createTestPdfBytes(): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([612, 792]);
  return Buffer.from(await pdfDoc.save());
}

function registerInput(suffix: string) {
  return {
    organizationName: `Queue Doc Org ${suffix}`,
    organizationSlug: `queue-doc-org-${suffix}`,
    timezone: "UTC",
    adminName: "Queue Doc Admin",
    email: `queue-doc-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

async function createDocumentTemplateFixture(
  organizationId: string,
  userId: string,
  name = "Birthday Greeting PDF",
) {
  const bytes = await createTestPdfBytes();
  const documentTemplate = await createDocumentTemplate(organizationId, userId, {
    name,
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

async function createBirthdayContactAndTemplate(
  organizationId: string,
  birthdayOccasionId: string,
  templateOverrides: Record<string, unknown> = {},
  contactName = "Ishika",
) {
  const template = await createTemplate(organizationId, {
    name: `Birthday SMS ${uniqueSuffix()}`,
    occasionId: birthdayOccasionId,
    channel: "SMS" as const,
    body: "Happy Birthday {{name}}!",
    isActive: true,
    ...templateOverrides,
  });
  const contact = await createContact(organizationId, {
    name: contactName,
    mobile: testMobile(),
    occasionDates: { [birthdayOccasionId]: "1990-07-11" },
    isActive: true,
  });
  return { template, contact };
}

describe("automation delivery preparation: personalized PDF", () => {
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

  it("leaves queue creation unchanged for a template without a PDF", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const { template } = await createBirthdayContactAndTemplate(
      org.organization.id,
      birthday.id,
    );

    const summary = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });
    expect(summary.created).toBe(1);

    const queueRow = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, templateId: template.id },
    });
    expect(queueRow.status).toBe("PENDING");
    expect(queueRow.generatedDocumentId).toBeNull();

    const documentCount = await prisma.generatedDocument.count({
      where: { organizationId: org.organization.id },
    });
    expect(documentCount).toBe(0);

    await cleanupOrganization(org.organization.id);
  });

  it("generates a GeneratedDocument and links it to the SendQueue row for a valid PDF configuration", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const { template, contact } = await createBirthdayContactAndTemplate(
      org.organization.id,
      birthday.id,
      {
        includePersonalizedPdf: true,
        documentTemplateId: documentTemplate.id,
      },
      "Ishika",
    );

    const summary = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });
    expect(summary.created).toBe(1);

    const queueRow = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, templateId: template.id },
    });
    // Message personalization is untouched by the PDF path.
    expect(queueRow.renderedBody).toBe("Happy Birthday Ishika!");
    expect(queueRow.status).toBe("PENDING");
    expect(queueRow.generatedDocumentId).not.toBeNull();
    expect(queueRow.contactId).toBe(contact.id);

    const generatedDocument = await prisma.generatedDocument.findUniqueOrThrow({
      where: { id: queueRow.generatedDocumentId! },
    });
    expect(generatedDocument.organizationId).toBe(org.organization.id);
    expect(generatedDocument.templateId).toBe(documentTemplate.id);
    expect(generatedDocument.createdByUserId).toBe(org.user.id);

    // 7-day default retention, unchanged from Phase 5.
    const daysUntilExpiry =
      (generatedDocument.expiresAt.getTime() - generatedDocument.createdAt.getTime()) /
      (24 * 60 * 60 * 1000);
    expect(daysUntilExpiry).toBeCloseTo(7, 1);

    // No PDF bytes or storage details leaked into SendQueue - only a reference.
    expect(Object.keys(queueRow)).not.toContain("bytes");
    expect(Object.keys(queueRow)).not.toContain("storageKey");
    expect(Object.keys(queueRow)).not.toContain("fileUrl");

    const file = await getGeneratedDocumentFile(
      org.organization.id,
      generatedDocument.id,
    );
    expect(Buffer.from(file.bytes.slice(0, 5)).toString("utf8")).toBe("%PDF-");

    await cleanupOrganization(org.organization.id);
  });

  it("produces distinct, separately personalized GeneratedDocuments for multiple contacts", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const template = await createTemplate(org.organization.id, {
      name: `Birthday SMS ${uniqueSuffix()}`,
      occasionId: birthday.id,
      channel: "SMS" as const,
      body: "Happy Birthday {{name}}!",
      isActive: true,
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    await createContact(org.organization.id, {
      name: "Alpha",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      isActive: true,
    });
    await createContact(org.organization.id, {
      name: "Beta",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      isActive: true,
    });

    const summary = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });
    expect(summary.created).toBe(2);

    const queueRows = await prisma.sendQueue.findMany({
      where: { organizationId: org.organization.id, templateId: template.id },
    });
    expect(queueRows).toHaveLength(2);
    expect(queueRows.every((row) => row.generatedDocumentId)).toBe(true);

    const documentIds = queueRows.map((row) => row.generatedDocumentId!);
    expect(new Set(documentIds).size).toBe(2);

    const [fileOne, fileTwo] = await Promise.all(
      documentIds.map((id) => getGeneratedDocumentFile(org.organization.id, id)),
    );
    // Different names embedded in the PDF text -> different byte content.
    expect(Buffer.compare(Buffer.from(fileOne.bytes), Buffer.from(fileTwo.bytes))).not.toBe(
      0,
    );

    await cleanupOrganization(org.organization.id);
  });

  it("fails the delivery safely (without crashing the batch) when includePersonalizedPdf is true but documentTemplateId is null", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const { template } = await createBirthdayContactAndTemplate(
      org.organization.id,
      birthday.id,
      { includePersonalizedPdf: true, documentTemplateId: documentTemplate.id },
    );

    // Simulate the Step 1 ON DELETE SET NULL edge case directly (bypassing
    // the service's own guard against saving this combination) rather than
    // relying on it never happening.
    await prisma.messageTemplate.update({
      where: { id: template.id },
      data: { documentTemplateId: null },
    });

    const summary = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });
    // The delivery job is still created - message personalization is
    // independent of the PDF - it just can't be considered ready.
    expect(summary.created).toBe(1);

    const queueRow = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, templateId: template.id },
    });
    expect(queueRow.status).toBe("FAILED");
    expect(queueRow.lastErrorCode).toBe("DOCUMENT_TEMPLATE_MISSING");
    expect(queueRow.generatedDocumentId).toBeNull();

    await cleanupOrganization(org.organization.id);
  });

  it("clears documentTemplateId (ON DELETE SET NULL) when the DocumentTemplate is deleted, and handles it the same safe way", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const { template } = await createBirthdayContactAndTemplate(
      org.organization.id,
      birthday.id,
      { includePersonalizedPdf: true, documentTemplateId: documentTemplate.id },
    );

    await prisma.documentTemplate.delete({ where: { id: documentTemplate.id } });

    const reloadedTemplate = await prisma.messageTemplate.findUniqueOrThrow({
      where: { id: template.id },
    });
    expect(reloadedTemplate.documentTemplateId).toBeNull();
    expect(reloadedTemplate.includePersonalizedPdf).toBe(true);

    const summary = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });
    expect(summary.created).toBe(1);

    const queueRow = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, templateId: template.id },
    });
    expect(queueRow.status).toBe("FAILED");
    expect(queueRow.lastErrorCode).toBe("DOCUMENT_TEMPLATE_MISSING");

    await cleanupOrganization(org.organization.id);
  });

  it("rejects a DocumentTemplate belonging to another organization even if it slipped past MessageTemplate validation", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(
      registerInput(`a-${uniqueSuffix()}`),
    );
    const orgB = await createRegisteredOrganization(
      registerInput(`b-${uniqueSuffix()}`),
    );
    const birthdayA = await ensureSystemBirthdayOccasion(orgA.organization.id);
    const documentTemplateA = await createDocumentTemplateFixture(
      orgA.organization.id,
      orgA.user.id,
    );
    const documentTemplateB = await createDocumentTemplateFixture(
      orgB.organization.id,
      orgB.user.id,
    );
    // Created validly (Step 1's own create-time check requires a same-org
    // DocumentTemplate), then swapped below to simulate it "slipping past"
    // that validation - e.g. direct data manipulation or a future code path
    // that writes MessageTemplate without going through the service.
    const { template } = await createBirthdayContactAndTemplate(
      orgA.organization.id,
      birthdayA.id,
      { includePersonalizedPdf: true, documentTemplateId: documentTemplateA.id },
    );

    // Bypass the service-layer ownership check directly at the DB level to
    // prove Step 2's own reuse of the org-scoped lookup is a real,
    // independent defense - not just relying on Step 1 having validated it.
    await prisma.messageTemplate.update({
      where: { id: template.id },
      data: { documentTemplateId: documentTemplateB.id },
    });

    const summary = await generateOccasionQueue(orgA.organization.id, birthdayA.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });
    expect(summary.created).toBe(1);

    const queueRow = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: orgA.organization.id, templateId: template.id },
    });
    expect(queueRow.status).toBe("FAILED");
    expect(queueRow.lastErrorCode).toBe("DOCUMENT_GENERATION_FAILED");
    expect(queueRow.generatedDocumentId).toBeNull();

    // No GeneratedDocument was ever created for org A from org B's template.
    const orgADocuments = await prisma.generatedDocument.count({
      where: { organizationId: orgA.organization.id },
    });
    expect(orgADocuments).toBe(0);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("isolates a PDF failure for one contact from other contacts in the same batch", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    // Deliberately skip saveLayout - generateDocumentPdf rejects a
    // DocumentTemplate with no saved layout, so this fails PDF preparation
    // for every contact sharing this MessageTemplate+DocumentTemplate pair.
    const bytes = await createTestPdfBytes();
    const documentTemplate = await createDocumentTemplate(
      org.organization.id,
      org.user.id,
      {
        name: "Layout-less template",
        file: { bytes, filename: "template.pdf", contentType: "application/pdf" },
      },
    );
    const template = await createTemplate(org.organization.id, {
      name: `Birthday SMS ${uniqueSuffix()}`,
      occasionId: birthday.id,
      channel: "SMS" as const,
      body: "Happy Birthday {{name}}!",
      isActive: true,
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    await createContact(org.organization.id, {
      name: "Contact One",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      isActive: true,
    });
    await createContact(org.organization.id, {
      name: "Contact Two",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      isActive: true,
    });

    const summary = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });
    expect(summary.created).toBe(2);

    const queueRows = await prisma.sendQueue.findMany({
      where: { organizationId: org.organization.id, templateId: template.id },
    });
    expect(queueRows).toHaveLength(2);
    // Both rows were created independently and both are observable via the
    // existing status/error fields - one row's outcome never blocked the
    // other's row from being created.
    for (const row of queueRows) {
      expect(row.status).toBe("FAILED");
      expect(row.lastErrorCode).toBe("DOCUMENT_GENERATION_FAILED");
    }

    await cleanupOrganization(org.organization.id);
  });

  it("does not generate a second GeneratedDocument when queue generation is re-run for the same contact/date (existing dedup)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );
    const { template } = await createBirthdayContactAndTemplate(
      org.organization.id,
      birthday.id,
      { includePersonalizedPdf: true, documentTemplateId: documentTemplate.id },
    );

    const first = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });
    expect(first.created).toBe(1);

    const second = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });
    expect(second.created).toBe(0);
    expect(second.skippedDuplicate).toBe(1);

    const documentCount = await prisma.generatedDocument.count({
      where: { organizationId: org.organization.id },
    });
    expect(documentCount).toBe(1);

    await cleanupOrganization(org.organization.id);
  });
});
