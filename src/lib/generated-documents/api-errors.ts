import type { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import {
  DocumentTemplateNotFoundError,
  DocumentTemplateValidationError,
} from "@/lib/document-templates/errors";
import {
  DocumentStorageNotConfiguredError,
  DocumentStorageOperationError,
} from "@/lib/storage";

import { GeneratedDocumentExpiredError, GeneratedDocumentNotFoundError } from "./errors";

/**
 * Maps every error this feature area (and the Phase 4 generator/storage
 * layer it depends on) can throw to an HTTP response - shared by every
 * generated-documents route so list/create/view/download/delete never
 * drift into three slightly different error mappings.
 */
export function generatedDocumentErrorResponse(
  error: unknown,
): NextResponse | null {
  if (error instanceof GeneratedDocumentNotFoundError) {
    return jsonError(error.message, 404);
  }
  if (error instanceof GeneratedDocumentExpiredError) {
    return jsonError(error.message, 410);
  }
  if (error instanceof DocumentTemplateNotFoundError) {
    return jsonError(error.message, 404);
  }
  if (error instanceof DocumentTemplateValidationError) {
    return jsonError(error.message, 400);
  }
  if (error instanceof DocumentStorageNotConfiguredError) {
    return jsonError("Document storage is not configured", 503);
  }
  if (error instanceof DocumentStorageOperationError) {
    return jsonError("Document storage is temporarily unavailable", 502);
  }
  return null;
}
