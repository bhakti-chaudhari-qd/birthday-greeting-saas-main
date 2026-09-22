import { ChannelProvider } from "@prisma/client";

import type { ResolvedWhatsAppMetaProviderConfig } from "@/lib/channel-config/whatsapp-types";

import { formatIndianWhatsAppRecipient } from "./format-recipient";
import { describeNetworkError } from "./post-multipart";
import {
  ProviderSendError,
  isWhatsAppSendRequest,
  type MessageProvider,
  type MessageSendRequest,
  type MessageSendResult,
} from "../types";

export type MetaWhatsAppProviderConfig = ResolvedWhatsAppMetaProviderConfig & {
  /** Test override - when set, replaces the global fetch. */
  fetchFn?: typeof fetch;
};

type MetaHeaderMediaType = "image" | "video" | "document";

/**
 * Maps our stored media content types to a Meta template header media type.
 * Meta's Cloud API does not accept WebM - only MP4/3GPP for video templates.
 */
function metaHeaderMediaType(contentType: string): MetaHeaderMediaType {
  if (contentType === "image/jpeg") {
    return "image";
  }
  if (contentType === "video/mp4") {
    return "video";
  }
  throw new ProviderSendError(
    `WhatsApp Meta Cloud API does not support media type ${contentType} (use JPEG image or MP4 video)`,
    "INVALID_BODY",
  );
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function describeMetaErrorBody(bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as {
      error?: { message?: string; error_user_msg?: string };
    };
    return (
      parsed.error?.error_user_msg ??
      parsed.error?.message ??
      bodyText.slice(0, 200)
    );
  } catch {
    return bodyText.slice(0, 200) || "(empty response body)";
  }
}

/**
 * Uploads media to Meta's Cloud API media endpoint so it can be referenced
 * by id in a template header component. Meta requires either an uploaded
 * media id or a public link for header media - raw bytes cannot ride along
 * with the /messages call the way the Custom HTTP gateway's `file` field does.
 */
async function uploadMetaMedia(
  fetchFn: typeof fetch,
  config: ResolvedWhatsAppMetaProviderConfig,
  media: { bytes: Buffer; filename: string; contentType: string },
  timeoutMs: number,
): Promise<string> {
  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/media`;
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", media.contentType);
  form.append(
    "file",
    new Blob([new Uint8Array(media.bytes)], { type: media.contentType }),
    media.filename,
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}` },
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderSendError(
        "WhatsApp media upload timed out",
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

  if (!response.ok) {
    const bodyText = await readErrorBody(response);
    throw new ProviderSendError(
      `WhatsApp media upload failed: ${describeMetaErrorBody(bodyText)}`,
      response.status >= 500 ? "PROVIDER_HTTP_5XX" : "PROVIDER_HTTP_4XX",
    );
  }

  const payload = (await response.json()) as { id?: unknown };
  if (typeof payload.id !== "string" || !payload.id.trim()) {
    throw new ProviderSendError(
      "WhatsApp media upload did not return a media id",
      "SUBMISSION_ERROR",
    );
  }

  return payload.id;
}

export function createMetaWhatsAppProvider(
  config: MetaWhatsAppProviderConfig,
): MessageProvider {
  const fetchFn = config.fetchFn ?? fetch;

  return {
    name: ChannelProvider.META,

    async send(request: MessageSendRequest): Promise<MessageSendResult> {
      if (!isWhatsAppSendRequest(request)) {
        throw new ProviderSendError(
          "Meta WhatsApp provider only accepts WhatsApp send requests",
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

      const to = formatIndianWhatsAppRecipient(request.recipient);

      const components: Record<string, unknown>[] = [];

      const media =
        request.media ??
        (config.mediaBytes && config.mediaFilename && config.mediaContentType
          ? {
              bytes: config.mediaBytes,
              filename: config.mediaFilename,
              contentType: config.mediaContentType,
            }
          : undefined);

      if (media) {
        const headerType = metaHeaderMediaType(media.contentType);
        const mediaId = await uploadMetaMedia(
          fetchFn,
          config,
          media,
          config.requestTimeoutMs,
        );
        components.push({
          type: "header",
          parameters: [
            {
              type: headerType,
              [headerType]: { id: mediaId },
            },
          ],
        });
      }

      if (request.parameterValues.length > 0) {
        components.push({
          type: "body",
          parameters: request.parameterValues.map((value) => ({
            type: "text",
            text: value,
          })),
        });
      }

      const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
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
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: request.templateName.trim(),
              language: { code: request.language.trim() },
              ...(components.length > 0 ? { components } : {}),
            },
          }),
          signal: controller.signal,
        });
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

      const bodyText = await response.text();

      console.info("WhatsApp provider response", {
        idempotencyKey: request.idempotencyKey,
        httpStatus: response.status,
        provider: ChannelProvider.META,
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
          `WhatsApp provider rejected the request: ${describeMetaErrorBody(bodyText)}`,
          "PROVIDER_HTTP_4XX",
        );
      }

      let parsed: { messages?: { id?: unknown }[] };
      try {
        parsed = JSON.parse(bodyText) as { messages?: { id?: unknown }[] };
      } catch {
        throw new ProviderSendError(
          `WhatsApp provider returned a non-JSON response: ${bodyText.slice(0, 200)}`,
          "SUBMISSION_ERROR",
        );
      }

      const providerMessageId = parsed.messages?.[0]?.id;
      if (typeof providerMessageId !== "string" || !providerMessageId.trim()) {
        throw new ProviderSendError(
          "WhatsApp provider response did not include a message id",
          "SUBMISSION_ERROR",
        );
      }

      return {
        providerMessageId: providerMessageId.trim(),
        status: "SENT",
      };
    },
  };
}
