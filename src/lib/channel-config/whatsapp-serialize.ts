import { Channel, ChannelProvider, type ChannelConfig } from "@prisma/client";

import { decryptCredentials } from "@/lib/crypto/credentials";

import {
  whatsappHttpCredentialsSchema,
  whatsappHttpSettingsSchema,
  whatsappMetaCredentialsSchema,
  whatsappMetaSettingsSchema,
  whatsappTestSettingsSchema,
} from "./whatsapp-types";

export type SafeWhatsAppChannelConfigView = {
  channel: typeof Channel.WHATSAPP;
  configured: boolean;
  provider: ChannelProvider | null;
  isActive: boolean;
  credentialsConfigured: boolean;
  username?: string;
  /** True when auth is API-key mode (mutually exclusive with username). Never exposes the key itself. */
  apiKeyConfigured: boolean;
  baseUrl?: string;
  sendPath?: string;
  /** When true, Custom HTTP skips TLS certificate verification (testing). */
  tlsInsecure?: boolean;
  /** True when tenant media is stored for TEST simulation or Custom HTTP sends. */
  mediaConfigured: boolean;
  mediaFilename?: string;
  mediaContentType?: string;
  /** Meta Cloud API - WhatsApp Business phone number ID (not a secret). */
  phoneNumberId?: string;
  /** Meta Cloud API version, e.g. v21.0. */
  apiVersion?: string;
  /** True when a Meta Cloud API access token is stored. Never exposes the token itself. */
  accessTokenConfigured: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** Live wallet lookup is not available for the current WhatsApp provider. */
  walletBalanceSupported: boolean;
};

function safeCredentialSummaryFromConfig(config: ChannelConfig): {
  username?: string;
  apiKeyConfigured: boolean;
  accessTokenConfigured: boolean;
} {
  if (config.provider === ChannelProvider.META) {
    try {
      const credentials = whatsappMetaCredentialsSchema.parse(
        JSON.parse(decryptCredentials(config.encryptedCredentials)),
      );
      return {
        apiKeyConfigured: false,
        accessTokenConfigured: Boolean(credentials.accessToken?.trim()),
      };
    } catch {
      return { apiKeyConfigured: false, accessTokenConfigured: false };
    }
  }

  if (config.provider !== ChannelProvider.CUSTOM_HTTP) {
    return { apiKeyConfigured: false, accessTokenConfigured: false };
  }

  try {
    const credentials = whatsappHttpCredentialsSchema.parse(
      JSON.parse(decryptCredentials(config.encryptedCredentials)),
    );
    return {
      username: credentials.username,
      apiKeyConfigured: Boolean(credentials.apiKey?.trim()),
      accessTokenConfigured: false,
    };
  } catch {
    return { apiKeyConfigured: false, accessTokenConfigured: false };
  }
}

function safeSettingsFromConfig(config: ChannelConfig): {
  baseUrl?: string;
  sendPath?: string;
  tlsInsecure?: boolean;
  mediaConfigured: boolean;
  mediaFilename?: string;
  mediaContentType?: string;
  phoneNumberId?: string;
  apiVersion?: string;
} {
  if (config.provider === ChannelProvider.META) {
    try {
      const settings = whatsappMetaSettingsSchema.parse(config.settings ?? {});
      const mediaConfigured = Boolean(settings.mediaBase64?.trim());
      return {
        mediaConfigured,
        phoneNumberId: settings.phoneNumberId,
        ...(settings.apiVersion ? { apiVersion: settings.apiVersion } : {}),
        ...(mediaConfigured && settings.mediaFilename
          ? { mediaFilename: settings.mediaFilename }
          : {}),
        ...(mediaConfigured && settings.mediaContentType
          ? { mediaContentType: settings.mediaContentType }
          : {}),
      };
    } catch {
      return { mediaConfigured: false };
    }
  }

  if (config.provider === ChannelProvider.TEST) {
    try {
      const settings = whatsappTestSettingsSchema.parse(config.settings ?? {});
      const mediaConfigured = Boolean(settings.mediaBase64?.trim());
      return {
        mediaConfigured,
        ...(mediaConfigured && settings.mediaFilename
          ? { mediaFilename: settings.mediaFilename }
          : {}),
        ...(mediaConfigured && settings.mediaContentType
          ? { mediaContentType: settings.mediaContentType }
          : {}),
      };
    } catch {
      return { mediaConfigured: false };
    }
  }

  if (config.provider !== ChannelProvider.CUSTOM_HTTP) {
    return { mediaConfigured: false };
  }

  try {
    const settings = whatsappHttpSettingsSchema.parse(config.settings ?? {});
    const mediaConfigured = Boolean(settings.mediaBase64?.trim());
    return {
      baseUrl: settings.baseUrl,
      sendPath: settings.sendPath,
      tlsInsecure: settings.tlsInsecure === true,
      mediaConfigured,
      ...(mediaConfigured && settings.mediaFilename
        ? { mediaFilename: settings.mediaFilename }
        : {}),
      ...(mediaConfigured && settings.mediaContentType
        ? { mediaContentType: settings.mediaContentType }
        : {}),
    };
  } catch {
    return { mediaConfigured: false };
  }
}

export function serializeWhatsAppChannelConfig(
  config: ChannelConfig | null,
): SafeWhatsAppChannelConfigView {
  if (!config) {
    return {
      channel: Channel.WHATSAPP,
      configured: false,
      provider: null,
      isActive: false,
      credentialsConfigured: false,
      apiKeyConfigured: false,
      accessTokenConfigured: false,
      mediaConfigured: false,
      walletBalanceSupported: false,
    };
  }

  const { username, apiKeyConfigured, accessTokenConfigured } =
    safeCredentialSummaryFromConfig(config);
  const settings = safeSettingsFromConfig(config);

  return {
    channel: Channel.WHATSAPP,
    configured: true,
    provider: config.provider,
    isActive: config.isActive,
    credentialsConfigured:
      (config.provider === ChannelProvider.CUSTOM_HTTP &&
        (Boolean(username) || apiKeyConfigured)) ||
      (config.provider === ChannelProvider.META && accessTokenConfigured),
    apiKeyConfigured,
    accessTokenConfigured,
    mediaConfigured: settings.mediaConfigured,
    ...(username ? { username } : {}),
    ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
    ...(settings.sendPath ? { sendPath: settings.sendPath } : {}),
    ...(config.provider === ChannelProvider.CUSTOM_HTTP
      ? { tlsInsecure: settings.tlsInsecure === true }
      : {}),
    ...(settings.mediaFilename
      ? { mediaFilename: settings.mediaFilename }
      : {}),
    ...(settings.mediaContentType
      ? { mediaContentType: settings.mediaContentType }
      : {}),
    ...(settings.phoneNumberId ? { phoneNumberId: settings.phoneNumberId } : {}),
    ...(settings.apiVersion ? { apiVersion: settings.apiVersion } : {}),
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
    walletBalanceSupported: false,
  };
}
