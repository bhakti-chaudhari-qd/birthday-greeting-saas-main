import { createHash } from "node:crypto";

import type { ChannelConfig } from "@prisma/client";
import { ChannelProvider } from "@prisma/client";

import { decryptCredentials } from "@/lib/crypto/credentials";
import { ProviderSendError } from "@/lib/messaging/providers/types";

import {
  voiceCredentialsSchema,
  voiceSettingsSchema,
  type ResolvedVoiceProviderConfig,
  type VoiceSettings,
} from "./voice-types";

/**
 * The gateway uploads the audio before it answers, so a send takes far longer
 * than an SMS request (its own documented example took over 11 seconds).
 */
export const DEFAULT_VOICE_REQUEST_TIMEOUT_MS = 90_000;

export function buildVoiceHttpSettings(
  baseUrl: string,
  sendPath: string,
  route: string,
  callerId: string,
  options: { requestTimeoutMs?: number } = {},
): VoiceSettings {
  return voiceSettingsSchema.parse({
    baseUrl: baseUrl.trim().replace(/\/$/, ""),
    sendPath: sendPath.trim(),
    route: route.trim(),
    callerId: callerId.trim(),
    requestTimeoutMs:
      options.requestTimeoutMs ?? DEFAULT_VOICE_REQUEST_TIMEOUT_MS,
  });
}

export function resolveVoiceProviderConfig(
  channelConfig: ChannelConfig,
): ResolvedVoiceProviderConfig {
  if (channelConfig.provider !== ChannelProvider.CUSTOM_HTTP) {
    throw new ProviderSendError(
      "Call provider configuration is not supported for this provider",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  let decrypted: string;

  try {
    decrypted = decryptCredentials(channelConfig.encryptedCredentials);
  } catch {
    throw new ProviderSendError(
      "Call provider credentials could not be decrypted",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  let credentials;

  try {
    credentials = voiceCredentialsSchema.parse(JSON.parse(decrypted));
  } catch {
    throw new ProviderSendError(
      "Call provider credentials are invalid",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  let settings: VoiceSettings;

  try {
    settings = voiceSettingsSchema.parse(channelConfig.settings ?? {});
  } catch {
    throw new ProviderSendError(
      "Call gateway requires baseUrl, sendPath, route and callerId in channel settings",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  return {
    baseUrl: settings.baseUrl,
    sendPath: settings.sendPath,
    username: credentials.username,
    password: credentials.password,
    route: settings.route,
    callerId: settings.callerId,
    requestTimeoutMs:
      settings.requestTimeoutMs ?? DEFAULT_VOICE_REQUEST_TIMEOUT_MS,
  };
}

/**
 * Identifies the gateway account an uploaded audio file id belongs to. A file
 * id from one account means nothing on another, so it is only reused when
 * this key still matches (see VoiceRecording.providerFileKey).
 */
export function voiceProviderFileKey(
  config: Pick<ResolvedVoiceProviderConfig, "baseUrl" | "username">,
): string {
  return createHash("sha256")
    .update(`${config.baseUrl.toLowerCase()}\n${config.username}`)
    .digest("hex")
    .slice(0, 32);
}
