import { ChannelProvider } from "@prisma/client";

import type { ResolvedVoiceProviderConfig } from "@/lib/channel-config/voice-types";
import { toIndianProviderMobileDigits } from "@/lib/contacts/mobile";

import { assertPublicHttpTarget } from "../ssrf-guard";
import {
  ProviderSendError,
  isCallSendRequest,
  type CallMessageSendRequest,
  type MessageProvider,
  type MessageSendRequest,
  type MessageSendResult,
} from "../types";
import {
  mapLegacyVoiceStatusToError,
  parseLegacyVoiceResponse,
  type ParsedVoiceResponse,
} from "./parse-response";

export type LegacyHttpVoiceProviderConfig = ResolvedVoiceProviderConfig & {
  fetchFn?: typeof fetch;
};

export function formatIndianVoiceRecipient(mobile: string): string {
  try {
    return toIndianProviderMobileDigits(mobile);
  } catch {
    throw new ProviderSendError(
      "Call provider only supports Indian mobile numbers",
      "INVALID_RECIPIENT",
    );
  }
}

/**
 * Form fields for the gateway's SendVoice endpoint. With `oldFileId` the
 * audio already uploaded to the gateway is reused and no file is attached.
 */
export function buildLegacyVoiceForm(
  config: ResolvedVoiceProviderConfig,
  params: {
    numbers: string;
    audio: CallMessageSendRequest["audio"];
    oldFileId: string | null;
  },
): FormData {
  const form = new FormData();

  if (!params.oldFileId) {
    form.append(
      "VoiceFile",
      new Blob([new Uint8Array(params.audio.bytes)], { type: "audio/mpeg" }),
      params.audio.filename,
    );
  }

  form.append("Username", config.username);
  form.append("Password", config.password);
  form.append("Numbers", params.numbers);
  form.append("Route", config.route);
  form.append("Callerid", config.callerId);
  form.append("OldFileId", params.oldFileId ?? "");
  form.append("NumberType", "M");
  form.append("Repeat", "false");

  return form;
}

export function createLegacyHttpVoiceProvider(
  config: LegacyHttpVoiceProviderConfig,
): MessageProvider {
  const fetchFn = config.fetchFn ?? fetch;
  const requestUrl = new URL(config.sendPath, config.baseUrl).toString();

  async function post(form: FormData): Promise<ParsedVoiceResponse> {
    await assertPublicHttpTarget(requestUrl);

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.requestTimeoutMs,
    );

    try {
      // Credentials travel in the form body. Never log the form or the response.
      const response = await fetchFn(requestUrl, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new ProviderSendError(
            "Call provider rate limited the request",
            "PROVIDER_HTTP_429",
          );
        }

        if (response.status >= 500) {
          // The call may already be placed; HTTP 5xx alone does not prove otherwise.
          throw new ProviderSendError(
            "Call provider returned a server error",
            "PROVIDER_HTTP_5XX",
          );
        }

        throw new ProviderSendError(
          "Call provider rejected the request",
          "PROVIDER_HTTP_4XX",
        );
      }

      return parseLegacyVoiceResponse(await response.text());
    } catch (error) {
      if (error instanceof ProviderSendError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderSendError(
          "Call provider request timed out",
          "PROVIDER_TIMEOUT",
        );
      }

      throw new ProviderSendError(
        "Call provider request failed",
        "PROVIDER_NETWORK_ERROR",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    name: ChannelProvider.CUSTOM_HTTP,

    async send(request: MessageSendRequest): Promise<MessageSendResult> {
      if (!isCallSendRequest(request)) {
        throw new ProviderSendError(
          "Call provider only supports call send requests",
          "INVALID_BODY",
        );
      }

      if (!request.recipient.trim()) {
        throw new ProviderSendError("Recipient is required", "INVALID_RECIPIENT");
      }

      if (request.audio.bytes.length === 0) {
        throw new ProviderSendError("Call recording is empty", "INVALID_BODY");
      }

      const numbers = formatIndianVoiceRecipient(request.recipient);
      const oldFileId = request.providerFileId?.trim() || null;

      let parsed = await post(
        buildLegacyVoiceForm(config, {
          numbers,
          audio: request.audio,
          oldFileId,
        }),
      );

      // A rejection is definite (no call was placed), so when the stored file
      // id may be the cause - expired or removed on the gateway - upload the
      // audio again once. Bad credentials are never the file id's fault.
      if (!parsed.success && oldFileId && parsed.statusCode !== 2) {
        parsed = await post(
          buildLegacyVoiceForm(config, {
            numbers,
            audio: request.audio,
            oldFileId: null,
          }),
        );
      }

      if (!parsed.success) {
        const mapped = mapLegacyVoiceStatusToError(parsed.statusCode);
        throw new ProviderSendError(mapped.message, mapped.code);
      }

      return {
        providerMessageId: parsed.providerMessageId,
        status: "SENT",
        providerFileId: parsed.fileId ?? oldFileId ?? undefined,
      };
    },
  };
}
