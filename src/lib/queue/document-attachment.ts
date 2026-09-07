import type { DocumentStorage } from "@/lib/storage";
import {
  DocumentStorageNotConfiguredError,
  DocumentStorageOperationError,
} from "@/lib/storage/errors";
import {
  GeneratedDocumentExpiredError,
  GeneratedDocumentNotFoundError,
} from "@/lib/generated-documents/errors";
import { getGeneratedDocumentFile } from "@/lib/generated-documents/service";
import type { EmailAttachment } from "@/lib/messaging/providers/types";
import { ProviderSendError } from "@/lib/messaging/providers/types";

const GENERATED_PDF_CONTENT_TYPE = "application/pdf";

type ResolvedDocumentFile = {
  filename: string;
  bytes: Buffer;
  contentType: string;
};

/**
 * Bridges the document system (GeneratedDocument + storage) and the
 * channel-agnostic delivery layer: turns an already-prepared document into
 * generic file bytes, or throws a ProviderSendError the existing SendQueue
 * retry/failure machinery already knows how to classify. Shared by every
 * channel-specific resolver below so the retrieval/error-mapping logic
 * exists exactly once.
 *
 * Never generates or regenerates a PDF - Step 2 is the only writer of
 * GeneratedDocument. This only reads what's already there.
 */
async function resolveGeneratedDocumentFile(
  organizationId: string,
  input: { generatedDocumentId: string | null; includePersonalizedPdf: boolean },
  options: { storage?: DocumentStorage } = {},
): Promise<ResolvedDocumentFile | null> {
  if (!input.includePersonalizedPdf) {
    return null;
  }

  if (!input.generatedDocumentId) {
    // Reachable if a crash interrupted Step 2's post-generation loop before
    // this row got its generatedDocumentId. Never send without the
    // configured attachment - fail this attempt so it surfaces for retry
    // via the existing SendQueue failure path instead of silently omitting it.
    throw new ProviderSendError(
      "Personalized PDF has not been prepared for this delivery yet",
      "DOCUMENT_NOT_READY",
    );
  }

  try {
    const file = await getGeneratedDocumentFile(
      organizationId,
      input.generatedDocumentId,
      options,
    );

    return {
      filename: file.fileName,
      bytes: Buffer.from(file.bytes),
      contentType: GENERATED_PDF_CONTENT_TYPE,
    };
  } catch (error) {
    if (error instanceof GeneratedDocumentNotFoundError) {
      throw new ProviderSendError(
        "The personalized PDF for this delivery could not be found",
        "DOCUMENT_NOT_FOUND",
      );
    }

    if (error instanceof GeneratedDocumentExpiredError) {
      throw new ProviderSendError(
        "The personalized PDF for this delivery has expired",
        "DOCUMENT_EXPIRED",
      );
    }

    if (
      error instanceof DocumentStorageOperationError ||
      error instanceof DocumentStorageNotConfiguredError
    ) {
      throw new ProviderSendError(
        "Document storage is temporarily unavailable",
        "DOCUMENT_STORAGE_UNAVAILABLE",
      );
    }

    throw error;
  }
}

export async function resolveEmailPdfAttachment(
  organizationId: string,
  input: { generatedDocumentId: string | null; includePersonalizedPdf: boolean },
  options: { storage?: DocumentStorage } = {},
): Promise<EmailAttachment | null> {
  const file = await resolveGeneratedDocumentFile(organizationId, input, options);

  if (!file) {
    return null;
  }

  return {
    filename: file.filename,
    content: file.bytes,
    contentType: file.contentType,
  };
}

/** Matches WhatsAppMessageSendRequest["media"] - the same generic {bytes, filename, contentType} shape used for the existing image/video media attachment. */
export type WhatsAppDocumentMedia = {
  bytes: Buffer;
  filename: string;
  contentType: string;
};

export async function resolveWhatsAppPdfAttachment(
  organizationId: string,
  input: { generatedDocumentId: string | null; includePersonalizedPdf: boolean },
  options: { storage?: DocumentStorage } = {},
): Promise<WhatsAppDocumentMedia | null> {
  const file = await resolveGeneratedDocumentFile(organizationId, input, options);

  if (!file) {
    return null;
  }

  return {
    bytes: file.bytes,
    filename: file.filename,
    contentType: file.contentType,
  };
}
