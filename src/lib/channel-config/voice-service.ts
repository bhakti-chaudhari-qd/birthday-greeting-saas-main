import { Channel, ChannelProvider, type ChannelConfig } from "@prisma/client";

import {
  decryptCredentials,
  encryptCredentials,
  isEncryptedCredentials,
} from "@/lib/crypto/credentials";
import { prisma } from "@/lib/db";
import type { VoiceChannelConfigWriteInput } from "@/lib/validation/voice-channel-config";

import { ChannelConfigValidationError } from "./errors";
import { buildVoiceHttpSettings } from "./voice-resolve";
import { voiceCredentialsSchema, voiceSettingsSchema } from "./voice-types";

export const DEFAULT_VOICE_SEND_PATH = "/SendVoice.aspx";

/** What the client's settings screen sees - never the password itself. */
export type SafeVoiceChannelConfigView = {
  channel: typeof Channel.CALL;
  configured: boolean;
  isActive: boolean;
  credentialsConfigured: boolean;
  baseUrl: string;
  sendPath: string;
  username: string;
  route: string;
  callerId: string;
  updatedAt?: string;
};

function readCredentials(
  config: ChannelConfig | null,
): { username: string; password: string } | null {
  if (
    !config ||
    config.provider !== ChannelProvider.CUSTOM_HTTP ||
    !isEncryptedCredentials(config.encryptedCredentials)
  ) {
    return null;
  }

  try {
    return voiceCredentialsSchema.parse(
      JSON.parse(decryptCredentials(config.encryptedCredentials)),
    );
  } catch {
    return null;
  }
}

export function serializeVoiceChannelConfig(
  config: ChannelConfig | null,
): SafeVoiceChannelConfigView {
  const credentials = readCredentials(config);
  const settings = config
    ? voiceSettingsSchema.safeParse(config.settings ?? {})
    : null;

  return {
    channel: Channel.CALL,
    configured: Boolean(config),
    isActive: config?.isActive ?? false,
    credentialsConfigured: Boolean(credentials),
    baseUrl: settings?.success ? settings.data.baseUrl : "",
    sendPath: settings?.success ? settings.data.sendPath : DEFAULT_VOICE_SEND_PATH,
    username: credentials?.username ?? "",
    route: settings?.success ? settings.data.route : "",
    callerId: settings?.success ? settings.data.callerId : "",
    ...(config ? { updatedAt: config.updatedAt.toISOString() } : {}),
  };
}

async function getTenantVoiceChannelConfig(
  organizationId: string,
): Promise<ChannelConfig | null> {
  return prisma.channelConfig.findUnique({
    where: {
      organizationId_channel: { organizationId, channel: Channel.CALL },
    },
  });
}

export async function getVoiceChannelConfig(
  organizationId: string,
): Promise<SafeVoiceChannelConfigView> {
  return serializeVoiceChannelConfig(
    await getTenantVoiceChannelConfig(organizationId),
  );
}

export async function upsertVoiceChannelConfig(
  organizationId: string,
  input: VoiceChannelConfigWriteInput,
): Promise<SafeVoiceChannelConfigView> {
  const existing = await getTenantVoiceChannelConfig(organizationId);
  // Leaving the password blank on an edit keeps the one already on file.
  const password = input.password || readCredentials(existing)?.password;

  if (!password) {
    throw new ChannelConfigValidationError("Password is required");
  }

  const encryptedCredentials = encryptCredentials(
    JSON.stringify(
      voiceCredentialsSchema.parse({ username: input.username, password }),
    ),
  );
  const settings = buildVoiceHttpSettings(
    input.baseUrl,
    input.sendPath,
    input.route,
    input.callerId,
  );
  const data = {
    provider: ChannelProvider.CUSTOM_HTTP,
    encryptedCredentials,
    settings,
    isActive: input.isActive ?? true,
  };

  const config = await prisma.channelConfig.upsert({
    where: {
      organizationId_channel: { organizationId, channel: Channel.CALL },
    },
    create: { organizationId, channel: Channel.CALL, ...data },
    update: data,
  });

  return serializeVoiceChannelConfig(config);
}
