import path from "node:path";

import { Prisma } from "@prisma/client";
import { PageSizes, PDFDocument } from "pdf-lib";

import { prisma } from "@/lib/db";
import { resolveOccasionId } from "@/lib/occasions/queries";
import { OccasionValidationError } from "@/lib/occasions/service";
import type {
  CreateBlankDocumentTemplateInput,
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

import {
  convertWordToPdf,
  detectDocumentTemplateSourceKind,
} from "./word-to-pdf";

export const DOCUMENT_TEMPLATE_MAX_BYTES = 5 * 1024 * 1024;

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

const ALLOWED_TYPES_MESSAGE = "Only PDF or Word (.doc, .docx) files are allowed";

/**
 * Validates the upload and returns it as a PDF - Word documents are
 * converted, so the editor and generator only ever see PDFs.
 */
async function toPdfTemplateFile(file: {
  bytes: Buffer;
  filename: string;
}): Promise<{ bytes: Buffer; fileName: string }> {
  if (file.bytes.length === 0) {
    throw new DocumentTemplateValidationError("File is empty");
  }
  if (file.bytes.length > DOCUMENT_TEMPLATE_MAX_BYTES) {
    throw new DocumentTemplateValidationError("File must be 5MB or smaller");
  }
  const fileName = safeFileName(file.filename);
  const kind = detectDocumentTemplateSourceKind(file.bytes, fileName);
  if (!kind) {
    throw new DocumentTemplateValidationError(ALLOWED_TYPES_MESSAGE);
  }
  if (kind === "pdf") {
    return { bytes: file.bytes, fileName };
  }

  const pdf = await convertWordToPdf(file.bytes, kind);
  if (pdf.length > DOCUMENT_TEMPLATE_MAX_BYTES) {
    throw new DocumentTemplateValidationError(
      "Converted PDF must be 5MB or smaller",
    );
  }
  return {
    bytes: pdf,
    fileName: `${fileName.slice(0, -path.extname(fileName).length)}.pdf`,
  };
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
  const occasionId = await assertOccasionForOrganization(
    organizationId,
    input.occasionId,
  );
  // Convert after the cheap checks so a bad occasion doesn't cost a conversion.
  const pdf = await toPdfTemplateFile(input.file);

  return prisma.documentTemplate.create({
    data: {
      organizationId,
      name: input.name.trim(),
      occasionId,
      bytes: Uint8Array.from(pdf.bytes),
      fileName: pdf.fileName,
      contentType: "application/pdf",
      byteLength: pdf.bytes.length,
      createdByUserId,
    },
    select: LIST_SELECT,
  });
}

const BLANK_PAGE_DIMENSIONS: Record<
  CreateBlankDocumentTemplateInput["pageSize"],
  [number, number]
> = {
  A4: PageSizes.A4,
  LETTER: PageSizes.Letter,
};

/** Single white page - the editor only lays out page 1. */
export async function buildBlankTemplatePdf(
  pageSize: CreateBlankDocumentTemplateInput["pageSize"],
  orientation: CreateBlankDocumentTemplateInput["orientation"],
): Promise<Buffer> {
  const [shortSide, longSide] = BLANK_PAGE_DIMENSIONS[pageSize];
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage(
    orientation === "landscape" ? [longSide, shortSide] : [shortSide, longSide],
  );
  return Buffer.from(await pdfDoc.save());
}

/** Creates a template from a blank page, to be designed in the editor. */
export async function createBlankDocumentTemplate(
  organizationId: string,
  createdByUserId: string,
  input: CreateBlankDocumentTemplateInput,
): Promise<DocumentTemplateWithOccasion> {
  const occasionId = await assertOccasionForOrganization(
    organizationId,
    input.occasionId,
  );
  const name = input.name.trim();
  const bytes = await buildBlankTemplatePdf(input.pageSize, input.orientation);

  return prisma.documentTemplate.create({
    data: {
      organizationId,
      name,
      occasionId,
      bytes: Uint8Array.from(bytes),
      fileName: `${name.replace(/[\\/\0]/g, "-")}.pdf`,
      contentType: "application/pdf",
      byteLength: bytes.length,
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
