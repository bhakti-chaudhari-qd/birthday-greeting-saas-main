import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { createDocumentTemplate } from "@/lib/document-templates/service";
import { prisma } from "@/lib/db";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { TemplateValidationError } from "@/lib/templates/errors";
import {
  createTemplate,
  getTemplate,
  serializeTemplate,
  updateTemplate,
} from "@/lib/templates/service";
import { createTemplateSchema, updateTemplateSchema } from "@/lib/validation/template";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

const MINIMAL_PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF",
  "utf8",
);

function registerInput(suffix: string) {
  return {
    organizationName: `Template Doc Org ${suffix}`,
    organizationSlug: `template-doc-org-${suffix}`,
    timezone: "UTC",
    adminName: "Template Doc Admin",
    email: `template-doc-admin-${suffix}@test.local`,
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
  return createDocumentTemplate(organizationId, userId, {
    name,
    file: {
      bytes: MINIMAL_PDF_BYTES,
      filename: "template.pdf",
      contentType: "application/pdf",
    },
  });
}

function validTemplateInput(occasionId: string) {
  return {
    name: "Birthday SMS",
    occasionId,
    channel: "SMS" as const,
    body: "Happy Birthday {{name}}! Wishing you a wonderful year ahead.",
    isActive: true,
  };
}

describe("message template optional document attachment", () => {
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

  it("creates a template without a PDF (existing behavior unchanged)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    const template = await createTemplate(
      org.organization.id,
      validTemplateInput(birthday.id),
    );

    expect(template.includePersonalizedPdf).toBe(false);
    expect(template.documentTemplateId).toBeNull();

    const serialized = serializeTemplate(template);
    expect(serialized.includePersonalizedPdf).toBe(false);
    expect(serialized.documentTemplateId).toBeNull();
    expect(serialized.documentTemplateName).toBeNull();

    await cleanupOrganization(org.organization.id);
  });

  it("creates a template with a valid DocumentTemplate attached", async ({
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
      ...validTemplateInput(birthday.id),
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });

    expect(template.includePersonalizedPdf).toBe(true);
    expect(template.documentTemplateId).toBe(documentTemplate.id);

    const serialized = serializeTemplate(template);
    expect(serialized.documentTemplateName).toBe("Birthday Greeting PDF");

    await cleanupOrganization(org.organization.id);
  });

  it("updates a template to add a DocumentTemplate", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );

    const template = await createTemplate(
      org.organization.id,
      validTemplateInput(birthday.id),
    );
    expect(template.includePersonalizedPdf).toBe(false);

    const updated = await updateTemplate(org.organization.id, template.id, {
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });

    expect(updated.includePersonalizedPdf).toBe(true);
    expect(updated.documentTemplateId).toBe(documentTemplate.id);

    const reloaded = await getTemplate(org.organization.id, template.id);
    expect(reloaded.documentTemplateId).toBe(documentTemplate.id);

    await cleanupOrganization(org.organization.id);
  });

  it("updates a template to remove the DocumentTemplate", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );

    const template = await createTemplate(org.organization.id, {
      ...validTemplateInput(birthday.id),
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });

    const updated = await updateTemplate(org.organization.id, template.id, {
      includePersonalizedPdf: false,
    });

    expect(updated.includePersonalizedPdf).toBe(false);
    expect(updated.documentTemplateId).toBeNull();

    await cleanupOrganization(org.organization.id);
  });

  it("rejects includePersonalizedPdf=true with no documentTemplateId on create", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const parsed = createTemplateSchema.safeParse({
      ...validTemplateInput("cltest00000000000000000001"),
      includePersonalizedPdf: true,
    });
    expect(parsed.success).toBe(false);

    if (!databaseAvailable) return;
    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    await expect(
      createTemplate(org.organization.id, {
        ...validTemplateInput(birthday.id),
        includePersonalizedPdf: true,
      }),
    ).rejects.toBeInstanceOf(TemplateValidationError);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects includePersonalizedPdf=true with no documentTemplateId on update (service-level, effective-state check)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      validTemplateInput(birthday.id),
    );

    await expect(
      updateTemplate(org.organization.id, template.id, {
        includePersonalizedPdf: true,
      }),
    ).rejects.toBeInstanceOf(TemplateValidationError);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects the unambiguous same-request contradiction at the schema layer", () => {
    const parsed = updateTemplateSchema.safeParse({
      includePersonalizedPdf: true,
      documentTemplateId: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a nonexistent DocumentTemplate", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    await expect(
      createTemplate(org.organization.id, {
        ...validTemplateInput(birthday.id),
        includePersonalizedPdf: true,
        documentTemplateId: "cltestdoesnotexist0000000001",
      }),
    ).rejects.toBeInstanceOf(TemplateValidationError);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects a DocumentTemplate belonging to another organization", async ({
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
    const documentTemplateB = await createDocumentTemplateFixture(
      orgB.organization.id,
      orgB.user.id,
    );

    await expect(
      createTemplate(orgA.organization.id, {
        ...validTemplateInput(birthdayA.id),
        includePersonalizedPdf: true,
        documentTemplateId: documentTemplateB.id,
      }),
    ).rejects.toBeInstanceOf(TemplateValidationError);

    // Also verify the update path rejects the same cross-org attempt.
    const templateA = await createTemplate(
      orgA.organization.id,
      validTemplateInput(birthdayA.id),
    );
    await expect(
      updateTemplate(orgA.organization.id, templateA.id, {
        includePersonalizedPdf: true,
        documentTemplateId: documentTemplateB.id,
      }),
    ).rejects.toBeInstanceOf(TemplateValidationError);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("allows the same DocumentTemplate to be referenced by multiple MessageTemplates", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const documentTemplate = await createDocumentTemplateFixture(
      org.organization.id,
      org.user.id,
    );

    const templateOne = await createTemplate(org.organization.id, {
      ...validTemplateInput(birthday.id),
      name: "Birthday SMS One",
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });
    const templateTwo = await createTemplate(org.organization.id, {
      ...validTemplateInput(birthday.id),
      name: "Birthday SMS Two",
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });

    expect(templateOne.documentTemplateId).toBe(documentTemplate.id);
    expect(templateTwo.documentTemplateId).toBe(documentTemplate.id);
    expect(templateOne.id).not.toBe(templateTwo.id);

    await cleanupOrganization(org.organization.id);
  });

  it("does not delete the MessageTemplate when its DocumentTemplate is removed - clears the reference instead", async ({
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
      ...validTemplateInput(birthday.id),
      includePersonalizedPdf: true,
      documentTemplateId: documentTemplate.id,
    });

    await prisma.documentTemplate.delete({ where: { id: documentTemplate.id } });

    const reloaded = await prisma.messageTemplate.findUniqueOrThrow({
      where: { id: template.id },
    });
    expect(reloaded.documentTemplateId).toBeNull();

    await cleanupOrganization(org.organization.id);
  });
});
