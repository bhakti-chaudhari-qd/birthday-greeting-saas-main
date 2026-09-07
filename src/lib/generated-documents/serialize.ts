import type { GeneratedDocument } from "@prisma/client";

export type GeneratedDocumentWithTemplate = Omit<GeneratedDocument, "storageKey"> & {
  template?: { id: string; name: string } | null;
};

/** "Expired" is derived from expiresAt at read time - never a stored/synced flag. */
export function isGeneratedDocumentExpired(
  document: Pick<GeneratedDocument, "expiresAt">,
  now: Date = new Date(),
): boolean {
  return document.expiresAt.getTime() <= now.getTime();
}

export function serializeGeneratedDocument(
  document: GeneratedDocumentWithTemplate,
  now: Date = new Date(),
) {
  const expired = isGeneratedDocumentExpired(document, now);

  return {
    id: document.id,
    fileName: document.fileName,
    fileSize: document.fileSize,
    templateId: document.templateId,
    templateName: document.template?.name ?? null,
    createdAt: document.createdAt.toISOString(),
    expiresAt: document.expiresAt.toISOString(),
    status: expired ? ("EXPIRED" as const) : ("ACTIVE" as const),
    fileUrl: `/api/v1/generated-documents/${document.id}/file`,
  };
}

export type SerializedGeneratedDocument = ReturnType<
  typeof serializeGeneratedDocument
>;
