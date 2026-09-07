import { Prisma } from "@prisma/client";

import { generateDocumentPdf } from "@/lib/document-templates/generate.service";
import { prisma } from "@/lib/db";
import { documentStorage, type DocumentStorage } from "@/lib/storage";
import type { ListGeneratedDocumentsQuery } from "@/lib/validation/generated-document";

import {
  GeneratedDocumentExpiredError,
  GeneratedDocumentNotFoundError,
} from "./errors";
import {
  isGeneratedDocumentExpired,
  serializeGeneratedDocument,
  type GeneratedDocumentWithTemplate,
} from "./serialize";

export const DEFAULT_RETENTION_DAYS = 7;

const GENERATED_PDF_CONTENT_TYPE = "application/pdf";

const WITH_TEMPLATE_SELECT = {
  id: true,
  organizationId: true,
  templateId: true,
  fileName: true,
  fileSize: true,
  createdByUserId: true,
  createdAt: true,
  expiresAt: true,
  template: { select: { id: true, name: true } },
} satisfies Prisma.GeneratedDocumentSelect;

function buildStorageKey(organizationId: string): string {
  return `generated-documents/${organizationId}/${crypto.randomUUID()}.pdf`;
}

function retentionDaysToExpiresAt(retentionDays: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

/**
 * Generates a PDF via the existing Phase 4 engine (unchanged), stores it
 * through the storage abstraction, then records the metadata. The
 * generator never touches storage; this function is the only place that
 * wires the two together.
 */
export async function createGeneratedDocument(
  organizationId: string,
  userId: string,
  templateId: string,
  data: Record<string, string>,
  options: { retentionDays?: number; storage?: DocumentStorage } = {},
): Promise<GeneratedDocumentWithTemplate> {
  const storage = options.storage ?? documentStorage;
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;

  const generated = await generateDocumentPdf(organizationId, templateId, data);
  const storageKey = buildStorageKey(organizationId);

  await storage.upload(storageKey, generated.bytes, GENERATED_PDF_CONTENT_TYPE);

  try {
    return await prisma.generatedDocument.create({
      data: {
        organizationId,
        templateId,
        fileName: generated.fileName,
        storageKey,
        fileSize: generated.bytes.byteLength,
        createdByUserId: userId,
        expiresAt: retentionDaysToExpiresAt(retentionDays),
      },
      select: WITH_TEMPLATE_SELECT,
    });
  } catch (error) {
    try {
      await storage.delete(storageKey);
    } catch (cleanupError) {
      console.error(
        "Failed to clean up orphaned storage object after a failed GeneratedDocument insert",
        { storageKey, cleanupError },
      );
    }
    throw error;
  }
}

export async function listGeneratedDocuments(
  organizationId: string,
  query: ListGeneratedDocumentsQuery,
) {
  const where: Prisma.GeneratedDocumentWhereInput = { organizationId };

  const [total, documents] = await prisma.$transaction([
    prisma.generatedDocument.count({ where }),
    prisma.generatedDocument.findMany({
      where,
      select: WITH_TEMPLATE_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  const now = new Date();
  return {
    data: documents.map((document) => serializeGeneratedDocument(document, now)),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getGeneratedDocument(
  organizationId: string,
  documentId: string,
): Promise<GeneratedDocumentWithTemplate> {
  const document = await prisma.generatedDocument.findFirst({
    where: { id: documentId, organizationId },
    select: WITH_TEMPLATE_SELECT,
  });

  if (!document) {
    throw new GeneratedDocumentNotFoundError();
  }

  return document;
}

/**
 * Loads the actual PDF bytes for an org-owned, unexpired document. Every
 * view/download path must go through this - the expiry and org checks
 * live here once, not duplicated per route.
 */
export async function getGeneratedDocumentFile(
  organizationId: string,
  documentId: string,
  options: { storage?: DocumentStorage } = {},
): Promise<{ bytes: Uint8Array; fileName: string }> {
  const storage = options.storage ?? documentStorage;

  const document = await prisma.generatedDocument.findFirst({
    where: { id: documentId, organizationId },
    select: { storageKey: true, fileName: true, expiresAt: true },
  });

  if (!document) {
    throw new GeneratedDocumentNotFoundError();
  }

  if (isGeneratedDocumentExpired(document)) {
    throw new GeneratedDocumentExpiredError();
  }

  const bytes = await storage.download(document.storageKey);
  return { bytes, fileName: document.fileName };
}

/**
 * Deletes the storage object first; the metadata row is only removed once
 * that succeeds, so a storage failure never gets silently reported as a
 * successful delete (the row stays as an accurate record to retry later).
 */
export async function deleteGeneratedDocument(
  organizationId: string,
  documentId: string,
  options: { storage?: DocumentStorage } = {},
): Promise<void> {
  const storage = options.storage ?? documentStorage;

  const document = await prisma.generatedDocument.findFirst({
    where: { id: documentId, organizationId },
    select: { id: true, storageKey: true },
  });

  if (!document) {
    throw new GeneratedDocumentNotFoundError();
  }

  await storage.delete(document.storageKey);

  try {
    await prisma.generatedDocument.delete({ where: { id: document.id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new GeneratedDocumentNotFoundError();
    }
    throw error;
  }
}

export { serializeGeneratedDocument, isGeneratedDocumentExpired };
