import { ProviderSendError } from "@/lib/messaging/providers/types";

export type ParsedCustomWhatsAppSendResponse = {
  providerMessageId: string;
  messageStatus?: string;
};

/**
 * Parses CustomAPI WhatsApp send responses.
 * Observed success shape (Meta-like):
 * {
 *   "messaging_product": "whatsapp",
 *   "contacts": [...],
 *   "messages": [{ "id": "wamid....", "message_status": "accepted" }],
 *   "error": null
 * }
 */
export function parseCustomWhatsAppSendResponse(
  bodyText: string,
): ParsedCustomWhatsAppSendResponse {
  const trimmed = bodyText.trim();

  if (!trimmed) {
    throw new ProviderSendError(
      "WhatsApp provider returned an empty response",
      "SUBMISSION_ERROR",
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new ProviderSendError(
      `WhatsApp provider returned a non-JSON response: ${trimmed.slice(0, 200)}`,
      "SUBMISSION_ERROR",
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new ProviderSendError(
      "WhatsApp provider returned an invalid response",
      "SUBMISSION_ERROR",
    );
  }

  const record = parsed as Record<string, unknown>;

  if (record.error !== null && record.error !== undefined) {
    const errorMessage =
      typeof record.error === "string"
        ? record.error
        : typeof record.error === "object" &&
            record.error &&
            "message" in record.error &&
            typeof (record.error as { message?: unknown }).message === "string"
          ? (record.error as { message: string }).message
          : JSON.stringify(record.error);

    throw new ProviderSendError(
      `WhatsApp provider rejected the message: ${errorMessage}`,
      "SUBMISSION_ERROR",
    );
  }

  const messages = record.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ProviderSendError(
      "WhatsApp provider response did not include a message id",
      "SUBMISSION_ERROR",
    );
  }

  const first = messages[0];
  if (!first || typeof first !== "object") {
    throw new ProviderSendError(
      "WhatsApp provider response message was invalid",
      "SUBMISSION_ERROR",
    );
  }

  const id = (first as { id?: unknown }).id;
  if (typeof id !== "string" || !id.trim()) {
    throw new ProviderSendError(
      "WhatsApp provider response did not include a message id",
      "SUBMISSION_ERROR",
    );
  }

  const messageStatus = (first as { message_status?: unknown }).message_status;

  return {
    providerMessageId: id.trim(),
    messageStatus:
      typeof messageStatus === "string" ? messageStatus : undefined,
  };
}
