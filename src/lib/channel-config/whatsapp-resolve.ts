import type { ChannelConfig } from "@prisma/client";
import { ChannelProvider } from "@prisma/client";

import { decryptCredentials } from "@/lib/crypto/credentials";
import { ProviderSendError } from "@/lib/messaging/providers/types";

import {
  decodeWhatsAppMediaBase64,
  defaultFilenameForMediaType,
  stripWhatsAppMediaDataUrlPrefix,
  whatsappHttpCredentialsSchema,
  whatsappHttpSettingsSchema,
  type ResolvedWhatsAppHttpProviderConfig,
  type WhatsAppHttpSettings,
  type WhatsAppMediaContentType,
} from "./whatsapp-types";

/** Transport timeout only - not a vendor endpoint. */
export const DEFAULT_WHATSAPP_HTTP_REQUEST_TIMEOUT_MS = 60_000;

export type WhatsAppHttpMediaInput = {
  mediaBase64: string;
  mediaFilename: string;
  mediaContentType?: WhatsAppMediaContentType;
};

export function buildWhatsAppHttpSettings(
  baseUrl: string,
  sendPath: string,
  media?: WhatsAppHttpMediaInput | null,
  tlsInsecure: boolean = true,
): WhatsAppHttpSettings {
  const settings: WhatsAppHttpSettings = {
    baseUrl: baseUrl.trim().replace(/\/$/, ""),
    sendPath: sendPath.trim(),
    requestTimeoutMs: DEFAULT_WHATSAPP_HTTP_REQUEST_TIMEOUT_MS,
    tlsInsecure,
  };

  if (media?.mediaBase64.trim()) {
    const decoded = decodeWhatsAppMediaBase64(media.mediaBase64);
    const contentType = media.mediaContentType ?? decoded.contentType;
    settings.mediaBase64 = stripWhatsAppMediaDataUrlPrefix(media.mediaBase64);
    settings.mediaFilename =
      media.mediaFilename.trim() || defaultFilenameForMediaType(contentType);
    settings.mediaContentType = contentType;
  }

  return whatsappHttpSettingsSchema.parse(settings);
}

export function resolveWhatsAppHttpProviderConfig(
  channelConfig: ChannelConfig,
): ResolvedWhatsAppHttpProviderConfig {
  if (channelConfig.provider !== ChannelProvider.CUSTOM_HTTP) {
    throw new ProviderSendError(
      "WhatsApp provider configuration is not supported for this provider",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  let decrypted: string;

  try {
    decrypted = decryptCredentials(channelConfig.encryptedCredentials);
  } catch {
    throw new ProviderSendError(
      "WhatsApp provider credentials could not be decrypted",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  let credentials;

  try {
    credentials = whatsappHttpCredentialsSchema.parse(JSON.parse(decrypted));
  } catch {
    throw new ProviderSendError(
      "WhatsApp provider credentials are invalid",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  let settings: WhatsAppHttpSettings;

  try {
    settings = whatsappHttpSettingsSchema.parse(channelConfig.settings ?? {});
  } catch {
    throw new ProviderSendError(
      "WhatsApp Custom HTTP requires baseUrl and sendPath in channel settings",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  const resolved: ResolvedWhatsAppHttpProviderConfig = {
    baseUrl: settings.baseUrl,
    sendPath: settings.sendPath,
    username: credentials.username,
    password: credentials.password,
    apiKey: credentials.apiKey,
    requestTimeoutMs:
      settings.requestTimeoutMs ?? DEFAULT_WHATSAPP_HTTP_REQUEST_TIMEOUT_MS,
    // Default true so IP HTTPS / self-signed test gateways work like Postman.
    tlsInsecure: settings.tlsInsecure !== false,
  };

  if (settings.mediaBase64?.trim()) {
    try {
      const decoded = decodeWhatsAppMediaBase64(settings.mediaBase64);
      resolved.mediaBytes = decoded.bytes;
      resolved.mediaFilename =
        settings.mediaFilename?.trim() ||
        defaultFilenameForMediaType(decoded.contentType);
      resolved.mediaContentType =
        settings.mediaContentType ?? decoded.contentType;
    } catch (error) {
      throw new ProviderSendError(
        error instanceof Error
          ? error.message
          : "WhatsApp Custom HTTP media is invalid",
        "INVALID_PROVIDER_CONFIG",
      );
    }
  }

  return resolved;
}
