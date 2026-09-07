import type { ChannelConfig } from "@prisma/client";
import { ChannelProvider } from "@prisma/client";

import { decryptCredentials } from "@/lib/crypto/credentials";
import { ProviderSendError } from "@/lib/messaging/providers/types";

import {
  smsCredentialsSchema,
  smsSettingsSchema,
  type ResolvedSmsProviderConfig,
  type SmsSettings,
} from "./types";

/** Transport timeout only - not a vendor endpoint. */
export const DEFAULT_SMS_REQUEST_TIMEOUT_MS = 30_000;
export const DEFAULT_SMS_SUCCESS_STATUS_CODE = 1;

/** Fixed relative paths for the legacy HTTP testing adapter (status / balance). */
export const LEGACY_SMS_STATUS_PATH = "/status.aspx";
export const LEGACY_SMS_BALANCE_PATH = "/balance.aspx";

export function buildSmsHttpSettings(
  baseUrl: string,
  sendPath: string,
  route: string,
  senderId: string,
  options: {
    requestTimeoutMs?: number;
    successStatusCode?: number;
  } = {},
): SmsSettings {
  return smsSettingsSchema.parse({
    baseUrl: baseUrl.trim().replace(/\/$/, ""),
    sendPath: sendPath.trim(),
    route: route.trim(),
    senderId: senderId.trim(),
    requestTimeoutMs:
      options.requestTimeoutMs ?? DEFAULT_SMS_REQUEST_TIMEOUT_MS,
    successStatusCode:
      options.successStatusCode ?? DEFAULT_SMS_SUCCESS_STATUS_CODE,
  });
}

export function resolveSmsProviderConfig(
  channelConfig: ChannelConfig,
): ResolvedSmsProviderConfig {
  if (channelConfig.provider !== ChannelProvider.CUSTOM_HTTP) {
    throw new ProviderSendError(
      "SMS provider configuration is not supported for this provider",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  let decrypted: string;

  try {
    decrypted = decryptCredentials(channelConfig.encryptedCredentials);
  } catch {
    throw new ProviderSendError(
      "SMS provider credentials could not be decrypted",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  let credentials;

  try {
    credentials = smsCredentialsSchema.parse(JSON.parse(decrypted));
  } catch {
    throw new ProviderSendError(
      "SMS provider credentials are invalid",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  let settings: SmsSettings;

  try {
    settings = smsSettingsSchema.parse(channelConfig.settings ?? {});
  } catch {
    throw new ProviderSendError(
      "SMS Custom HTTP requires baseUrl and sendPath in channel settings",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  return {
    baseUrl: settings.baseUrl,
    sendPath: settings.sendPath,
    username: credentials.username,
    password: credentials.password,
    route: settings.route,
    senderId: settings.senderId,
    requestTimeoutMs:
      settings.requestTimeoutMs ?? DEFAULT_SMS_REQUEST_TIMEOUT_MS,
    successStatusCode:
      settings.successStatusCode ?? DEFAULT_SMS_SUCCESS_STATUS_CODE,
  };
}
