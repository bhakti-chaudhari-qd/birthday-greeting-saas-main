import type { ResolvedWhatsAppHttpProviderConfig } from "@/lib/channel-config/whatsapp-types";

import { buildCustomWhatsAppSendUrl } from "./custom-http-whatsapp-provider";
import { formatIndianWhatsAppRecipient } from "./format-recipient";
import { describeNetworkError } from "./post-multipart";
import { assertPublicHttpTarget } from "../ssrf-guard";
import {
  ProviderSendError,
  isWhatsAppSendRequest,
  type MessageProvider,
  type MessageSendRequest,
  type MessageSendResult,
} from "../types";

export type KoverageWhatsAppProviderConfig =
  ResolvedWhatsAppHttpProviderConfig & {
    /** Test override - when set, replaces the global fetch. */
    fetchFn?: typeof fetch;
  };

const KOVERAGE_MESSAGE_ID_KEYS = [
  "wamid",
  "whatsapp_message_id",
  "message_id",
  "log_uid",
  "uid",
] as const;

function firstMessageId(source: unknown): string | null {
  if (!source || typeof source !== "object") {
    return null;
  }
  const record = source as Record<string, unknown>;
  for (const key of KOVERAGE_MESSAGE_ID_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function describeKoverageBody(bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as { message?: unknown };
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim().slice(0, 200);
    }
  } catch {
    // Fall through to the raw body.
  }
  return bodyText.slice(0, 200) || "(empty response body)";
}

/**
 * Koverage's send-message API: a JSON POST with a Bearer token, the template
 * name/language, and body variables as field_1, field_2, ... in order. Header
 * media is taken as a public URL there, which this app does not have for its
 * stored media, so media greetings are rejected up front instead of being
 * sent without their image or video.
 */
export function createKoverageWhatsAppProvider(
  config: KoverageWhatsAppProviderConfig,
): MessageProvider {
  const fetchFn = config.fetchFn ?? fetch;

  return {
    name: "KOVERAGE",

    async send(request: MessageSendRequest): Promise<MessageSendResult> {
      if (!isWhatsAppSendRequest(request)) {
        throw new ProviderSendError(
          "Koverage WhatsApp provider only accepts WhatsApp send requests",
          "INVALID_BODY",
        );
      }

      if (!request.templateName.trim()) {
        throw new ProviderSendError(
          "WhatsApp template name is required",
          "MISSING_TEMPLATE_ID",
        );
      }

      if (!request.language.trim()) {
        throw new ProviderSendError(
          "WhatsApp language is required",
          "INVALID_BODY",
        );
      }

      if (!config.apiKey) {
        throw new ProviderSendError(
          "Koverage API token is not configured",
          "INVALID_PROVIDER_CONFIG",
        );
      }

      if (request.media) {
        throw new ProviderSendError(
          "The Koverage gateway cannot send image or video greetings - use a text-only WhatsApp template",
          "INVALID_BODY",
        );
      }

      const url = buildCustomWhatsAppSendUrl(config);
      await assertPublicHttpTarget(url);

      const payload: Record<string, string> = {
        phone_number: formatIndianWhatsAppRecipient(request.recipient),
        template_name: request.templateName.trim(),
        template_language: request.language.trim(),
      };
      request.parameterValues.forEach((value, index) => {
        payload[`field_${index + 1}`] = value;
      });

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        config.requestTimeoutMs,
      );

      let response: Response;
      try {
        response = await fetchFn(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new ProviderSendError(
            "WhatsApp provider request timed out",
            "PROVIDER_TIMEOUT",
          );
        }
        throw new ProviderSendError(
          describeNetworkError(error),
          "PROVIDER_NETWORK_ERROR",
        );
      } finally {
        clearTimeout(timeout);
      }

      const bodyText = await response.text();

      console.info("WhatsApp provider response", {
        idempotencyKey: request.idempotencyKey,
        httpStatus: response.status,
        provider: "KOVERAGE",
      });

      if (response.status === 429) {
        throw new ProviderSendError(
          "WhatsApp provider rate limited the request",
          "PROVIDER_HTTP_429",
        );
      }

      if (response.status >= 500) {
        throw new ProviderSendError(
          "WhatsApp provider returned a server error",
          "PROVIDER_HTTP_5XX",
        );
      }

      if (response.status >= 400) {
        throw new ProviderSendError(
          `WhatsApp provider rejected the request: ${describeKoverageBody(bodyText)}`,
          "PROVIDER_HTTP_4XX",
        );
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(bodyText) as Record<string, unknown>;
      } catch {
        throw new ProviderSendError(
          `WhatsApp provider returned a non-JSON response: ${bodyText.slice(0, 200)}`,
          "SUBMISSION_ERROR",
        );
      }

      // Koverage reports a rejected send with HTTP 200 and a non-success result.
      if (parsed.result !== "success") {
        throw new ProviderSendError(
          `WhatsApp provider rejected the message: ${describeKoverageBody(bodyText)}`,
          "SUBMISSION_ERROR",
        );
      }

      return {
        // The accepted response does not always carry a message id; the
        // idempotency key keeps the delivery row traceable when it doesn't.
        providerMessageId:
          firstMessageId(parsed.data) ??
          firstMessageId(parsed) ??
          request.idempotencyKey,
        status: "SENT",
      };
    },
  };
}
