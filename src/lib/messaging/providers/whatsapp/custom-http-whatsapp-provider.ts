import { ChannelProvider } from "@prisma/client";

import type { ResolvedWhatsAppHttpProviderConfig } from "@/lib/channel-config/whatsapp-types";

import {
  DEFAULT_WHATSAPP_MEDIA_CONTENT_TYPE,
  DEFAULT_WHATSAPP_MEDIA_FILENAME,
  getDefaultWhatsAppMediaJpeg,
} from "./default-media";
import { formatIndianWhatsAppRecipient } from "./format-recipient";
import { parseCustomWhatsAppSendResponse } from "./parse-response";
import {
  describeNetworkError,
  postWhatsAppMultipart,
} from "./post-multipart";
import {
  ProviderSendError,
  isWhatsAppSendRequest,
  type MessageProvider,
  type MessageSendRequest,
  type MessageSendResult,
} from "../types";

export type CustomHttpWhatsAppProviderConfig =
  ResolvedWhatsAppHttpProviderConfig & {
    /** Test override - when set, skips the native multipart client. */
    fetchFn?: typeof fetch;
    mediaBytes?: Buffer;
    mediaFilename?: string;
    mediaContentType?: string;
  };

/**
 * Best-effort, non-throwing extraction of loggable fields from the raw
 * provider response - used only for observability, never for control flow
 * (parseCustomWhatsAppSendResponse remains the single source of truth for
 * what counts as success). Truncates/omits anything free-form so nothing
 * unbounded (or a credential echoed back by a misbehaving provider) ends up
 * in logs.
 */
function describeRawResponseForLog(bodyText: string): {
  messageStatus: string | null;
  providerMessageId: string | null;
  error: string | null;
} {
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>;
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    const first = messages[0] as Record<string, unknown> | undefined;
    const messageStatus =
      typeof first?.message_status === "string" ? first.message_status : null;
    const providerMessageId = typeof first?.id === "string" ? first.id : null;
    const error =
      parsed.error === null || parsed.error === undefined
        ? null
        : JSON.stringify(parsed.error).slice(0, 200);

    return { messageStatus, providerMessageId, error };
  } catch {
    return {
      messageStatus: null,
      providerMessageId: null,
      error: bodyText.slice(0, 200) || "(empty response body)",
    };
  }
}

export function buildCustomWhatsAppSendUrl(
  config: Pick<ResolvedWhatsAppHttpProviderConfig, "baseUrl" | "sendPath">,
): string {
  return new URL(config.sendPath, config.baseUrl).toString();
}

async function fetchProviderResponseWithFetch(
  fetchFn: typeof fetch,
  url: string,
  form: FormData,
  timeoutMs: number,
): Promise<{ status: number; bodyText: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    const bodyText = await response.text();
    return { status: response.status, bodyText };
  } catch (error) {
    if (error instanceof ProviderSendError) {
      throw error;
    }

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
}

async function fetchProviderResponseNative(
  url: string,
  fields: Record<string, string>,
  file: {
    filename: string;
    contentType: string;
    bytes: Buffer;
  },
  timeoutMs: number,
  tlsInsecure: boolean,
): Promise<{ status: number; bodyText: string }> {
  try {
    return await postWhatsAppMultipart(
      url,
      fields,
      {
        fieldName: "file",
        filename: file.filename,
        contentType: file.contentType,
        bytes: file.bytes,
      },
      { timeoutMs, tlsInsecure },
    );
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
  }
}

export function createCustomHttpWhatsAppProvider(
  config: CustomHttpWhatsAppProviderConfig,
): MessageProvider {
  const tlsInsecure = config.tlsInsecure !== false;

  return {
    name: ChannelProvider.CUSTOM_HTTP,

    async send(request: MessageSendRequest): Promise<MessageSendResult> {
      if (!isWhatsAppSendRequest(request)) {
        throw new ProviderSendError(
          "Custom WhatsApp provider only accepts WhatsApp send requests",
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

      const mobileNumber = formatIndianWhatsAppRecipient(request.recipient);
      const url = buildCustomWhatsAppSendUrl(config);
      const mediaBytes =
        request.media?.bytes ??
        config.mediaBytes ??
        getDefaultWhatsAppMediaJpeg();
      const mediaFilename =
        request.media?.filename ??
        config.mediaFilename ??
        DEFAULT_WHATSAPP_MEDIA_FILENAME;
      const mediaContentType =
        request.media?.contentType ??
        config.mediaContentType ??
        DEFAULT_WHATSAPP_MEDIA_CONTENT_TYPE;

      const fields: Record<string, string> = {};

      // API-key gateways (apikey_wp) and username/password gateways
      // (CustomAPI) are mutually exclusive auth modes on the same Custom
      // HTTP provider type - apiKey takes priority when both happen to be
      // configured, otherwise fall back to the pre-existing username/password
      // fields so nothing changes for gateways already using them.
      if (config.apiKey) {
        fields.apikey_wp = config.apiKey;
      } else if (config.username) {
        fields.username = config.username;
        if (config.password) {
          fields.password = config.password;
        }
      }

      fields.MobileNumber = mobileNumber;
      fields.TemplateName = request.templateName.trim();
      fields.language = request.language.trim();

      // Reuses the existing WhatsApp parameter-order/personalization system
      // (resolveWhatsAppParameterValues) - param_v1, param_v2, ... in order,
      // no separate parameter mechanism.
      request.parameterValues.forEach((value, index) => {
        fields[`param_v${index + 1}`] = value;
      });

      let status: number;
      let bodyText: string;

      if (config.fetchFn) {
        const form = new FormData();
        for (const [key, value] of Object.entries(fields)) {
          form.append(key, value);
        }
        form.append(
          "file",
          new Blob([new Uint8Array(mediaBytes)], { type: mediaContentType }),
          mediaFilename,
        );

        ({ status, bodyText } = await fetchProviderResponseWithFetch(
          config.fetchFn,
          url,
          form,
          config.requestTimeoutMs,
        ));
      } else {
        ({ status, bodyText } = await fetchProviderResponseNative(
          url,
          fields,
          {
            filename: mediaFilename,
            contentType: mediaContentType,
            bytes: mediaBytes,
          },
          config.requestTimeoutMs,
          tlsInsecure,
        ));
      }

      console.info("WhatsApp provider response", {
        idempotencyKey: request.idempotencyKey,
        httpStatus: status,
        ...describeRawResponseForLog(bodyText),
      });

      if (status === 429) {
        throw new ProviderSendError(
          "WhatsApp provider rate limited the request",
          "PROVIDER_HTTP_429",
        );
      }

      if (status >= 500) {
        throw new ProviderSendError(
          "WhatsApp provider returned a server error",
          "PROVIDER_HTTP_5XX",
        );
      }

      if (status >= 400) {
        throw new ProviderSendError(
          `WhatsApp provider rejected the request: ${bodyText.slice(0, 200)}`,
          "PROVIDER_HTTP_4XX",
        );
      }

      const parsed = parseCustomWhatsAppSendResponse(bodyText);

      return {
        providerMessageId: parsed.providerMessageId,
        status: "SENT",
      };
    },
  };
}
