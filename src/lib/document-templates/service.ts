import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { resolveOccasionId } from "@/lib/occasions/queries";
import { OccasionValidationError } from "@/lib/occasions/service";
import type {
  CreateDocumentTemplateMetadataInput,
  ListDocumentTemplatesQuery,
  UpdateDocumentTemplateInput,
} from "@/lib/validation/document-template";

import {
  DocumentTemplateNotFoundError,
  DocumentTemplateValidationError,
} from "./errors";
import {
  buildDocumentTemplateListWhere,
  serializeDocumentTemplate,
  type DocumentTemplateWithOccasion,
} from "./serialize";

export const DOCUMENT_TEMPLATE_MAX_BYTES = 5 * 1024 * 1024;
const PDF_MAGIC_BYTES = Buffer.from("%PDF-", "utf8");

const LIST_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  occasionId: true,
  fileName: true,
  contentType: true,
  byteLength: true,
  createdByUserId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  occasion: { select: { id: true, name: true } },
} satisfies Prisma.DocumentTemplateSelect;

function safeFileName(filename: string | undefined): string {
  const value = filename?.trim() || "template.pdf";
  if (value.length > 120 || /[\\/\0]/.test(value)) {
    throw new DocumentTemplateValidationError("Invalid file name");
  }
  return value;
}

function assertPdfFile(bytes: Buffer, contentType: string | undefined) {
  if (bytes.length === 0) {
    throw new DocumentTemplateValidationError("PDF file is empty");
  }
  if (bytes.length > DOCUMENT_TEMPLATE_MAX_BYTES) {
    throw new DocumentTemplateValidationError("PDF must be 5MB or smaller");
  }
  if (contentType && contentType !== "application/pdf") {
    throw new DocumentTemplateValidationError("Only PDF files are allowed");
  }
  if (!bytes.subarray(0, 5).equals(PDF_MAGIC_BYTES)) {
    throw new DocumentTemplateValidationError("Only PDF files are allowed");
  }
}

/** Confirms an occasionId belongs to the org; null/undefined clears it. */
async function assertOccasionForOrganization(
  organizationId: string,
  occasionId: string | null | undefined,
): Promise<string | null> {
  if (occasionId === undefined || occasionId === null) {
    return null;
  }
  try {
    return await resolveOccasionId(organizationId, occasionId);
  } catch (error) {
    if (error instanceof OccasionValidationError) {
      throw new DocumentTemplateValidationError(error.message);
    }
    throw error;
  }
}

export async function createDocumentTemplate(
  organizationId: string,
  createdByUserId: string,
  input: CreateDocumentTemplateMetadataInput & {
    file: { bytes: Buffer; filename: string; contentType: string };
  },
): Promise<DocumentTemplateWithOccasion> {
  assertPdfFile(input.file.bytes, input.file.contentType);
  const fileName = safeFileName(input.file.filename);
  const occasionId = await assertOccasionForOrganization(
    organizationId,
    input.occasionId,
  );

  return prisma.documentTemplate.create({
    data: {
      organizationId,
      name: input.name.trim(),
      occasionId,
      bytes: Uint8Array.from(input.file.bytes),
      fileName,
      contentType: "application/pdf",
      byteLength: input.file.bytes.length,
      createdByUserId,
    },
    select: LIST_SELECT,
  });
}

export async function listDocumentTemplates(
  organizationId: string,
  query: ListDocumentTemplatesQuery,
) {
  const where = buildDocumentTemplateListWhere(organizationId, query);

  const [total, templates] = await prisma.$transaction([
    prisma.documentTemplate.count({ where }),
    prisma.documentTemplate.findMany({
      where,
      select: LIST_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    data: templates.map(serializeDocumentTemplate),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getDocumentTemplate(
  organizationId: string,
  templateId: string,
): Promise<DocumentTemplateWithOccasion> {
  const template = await prisma.documentTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: LIST_SELECT,
  });

  if (!template) {
    throw new DocumentTemplateNotFoundError();
  }

  return template;
}

/** Includes the PDF bytes - only for the file-serving route, never list/get metadata. */
export async function getDocumentTemplateFile(
  organizationId: string,
  templateId: string,
) {
  const template = await prisma.documentTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: {
      bytes: true,
      fileName: true,
      contentType: true,
      byteLength: true,
    },
  });

  if (!template) {
    throw new DocumentTemplateNotFoundError();
  }

  return template;
}

export async function updateDocumentTemplate(
  organizationId: string,
  templateId: string,
  input: UpdateDocumentTemplateInput,
): Promise<DocumentTemplateWithOccasion> {
  await getDocumentTemplate(organizationId, templateId);

  const occasionId =
    input.occasionId !== undefined
      ? await assertOccasionForOrganization(organizationId, input.occasionId)
      : undefined;

  try {
    return await prisma.documentTemplate.update({
      where: { id: templateId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(occasionId !== undefined ? { occasionId } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: LIST_SELECT,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new DocumentTemplateNotFoundError();
    }
    throw error;
  }
}

export async function deleteDocumentTemplate(
  organizationId: string,
  templateId: string,
): Promise<void> {
  const template = await prisma.documentTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: { id: true },
  });

  if (!template) {
    throw new DocumentTemplateNotFoundError();
  }

  try {
    await prisma.documentTemplate.delete({ where: { id: template.id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new DocumentTemplateNotFoundError();
    }
    throw error;
  }
}

export { serializeDocumentTemplate };
