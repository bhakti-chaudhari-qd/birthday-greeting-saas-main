import { QueueStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { createGeneratedDocument } from "@/lib/generated-documents/service";
import { templateValuesForContact } from "@/lib/templates/variables";

type QueueDocumentContact = Parameters<typeof templateValuesForContact>[0];

/**
 * Coerces the shared contact-personalization values (the same ones used to
 * render {{name}} in the message body) into the plain string map the PDF
 * generator expects. Reuses templateValuesForContact rather than a second
 * contact -> variables mapping.
 */
function toDocumentVariableData(
  values: ReturnType<typeof templateValuesForContact>,
): Record<string, string> {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined) {
      data[key] = String(value);
    }
  }
  return data;
}

async function markDocumentPreparationFailed(
  sendQueueId: string,
  errorCode: string,
  message: string,
): Promise<void> {
  await prisma.sendQueue.update({
    where: { id: sendQueueId },
    data: {
      status: QueueStatus.FAILED,
      lastError: message,
      lastErrorCode: errorCode,
      // Not a transient provider hiccup - retrying without fixing the
      // template/document configuration would fail identically.
      nextAttemptAt: null,
    },
  });
}

/**
 * Generates a personalized PDF for one queued delivery and links it to the
 * SendQueue row (generatedDocumentId), or marks that row FAILED using the
 * existing queue failure fields when it can't be prepared.
 *
 * Always call this OUTSIDE any DB transaction: PDF rendering and the B2
 * upload it triggers (via the existing GeneratedDocument service) are
 * network/CPU-bound and must never hold a transaction open. Each call is
 * independent - one contact's failure here never touches another
 * contact's row, and reuses the existing PDF generation (Phase 4) and
 * GeneratedDocument (Phase 5) services as-is.
 */
export async function prepareQueueDocument(input: {
  organizationId: string;
  sendQueueId: string;
  createdByUserId: string;
  documentTemplateId: string | null;
  contact: QueueDocumentContact;
}): Promise<void> {
  if (!input.documentTemplateId) {
    // Step 1's DocumentTemplate relation is ON DELETE SET NULL, so
    // includePersonalizedPdf=true with documentTemplateId=null is a real,
    // reachable state (not just a theoretical one) - never attempt
    // generation from nothing, and never send silently without the
    // required PDF. Surface it the same way a generation failure is.
    await markDocumentPreparationFailed(
      input.sendQueueId,
      "DOCUMENT_TEMPLATE_MISSING",
      "Personalized PDF is enabled but no document template is configured",
    );
    return;
  }

  try {
    const data = toDocumentVariableData(templateValuesForContact(input.contact));
    const generatedDocument = await createGeneratedDocument(
      input.organizationId,
      input.createdByUserId,
      input.documentTemplateId,
      data,
    );

    await prisma.sendQueue.update({
      where: { id: input.sendQueueId },
      data: { generatedDocumentId: generatedDocument.id },
    });
  } catch (error) {
    await markDocumentPreparationFailed(
      input.sendQueueId,
      "DOCUMENT_GENERATION_FAILED",
      error instanceof Error
        ? error.message
        : "Failed to generate personalized document",
    );
  }
}
