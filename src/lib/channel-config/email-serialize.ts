import { Channel, ChannelProvider, type ChannelConfig } from "@prisma/client";

import { decryptCredentials } from "@/lib/crypto/credentials";

import { emailResendCredentialsSchema, emailResendSettingsSchema } from "./email-types";

export type SafeEmailChannelConfigView = {
  channel: typeof Channel.EMAIL;
  configured: boolean;
  provider: ChannelProvider | null;
  isActive: boolean;
  credentialsConfigured: boolean;
  fromEmail?: string;
  fromName?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Sender used when the client has no config of its own; null when the platform has no email sender set up. */
  platformDefaultFrom?: string | null;
};

function safeCredentialSummaryFromConfig(config: ChannelConfig): {
  credentialsConfigured: boolean;
} {
  if (config.provider !== ChannelProvider.RESEND) {
    return { credentialsConfigured: false };
  }

  try {
    const credentials = emailResendCredentialsSchema.parse(
      JSON.parse(decryptCredentials(config.encryptedCredentials)),
    );
    return { credentialsConfigured: Boolean(credentials.apiKey?.trim()) };
  } catch {
    return { credentialsConfigured: false };
  }
}

function safeSettingsFromConfig(config: ChannelConfig): {
  fromEmail?: string;
  fromName?: string;
} {
  if (config.provider !== ChannelProvider.RESEND) {
    return {};
  }

  try {
    const settings = emailResendSettingsSchema.parse(config.settings ?? {});
    return {
      fromEmail: settings.fromEmail,
      ...(settings.fromName ? { fromName: settings.fromName } : {}),
    };
  } catch {
    return {};
  }
}

export function serializeEmailChannelConfig(
  config: ChannelConfig | null,
): SafeEmailChannelConfigView {
  if (!config) {
    return {
      channel: Channel.EMAIL,
      configured: false,
      provider: null,
      isActive: false,
      credentialsConfigured: false,
    };
  }

  const { credentialsConfigured } = safeCredentialSummaryFromConfig(config);
  const { fromEmail, fromName } = safeSettingsFromConfig(config);

  return {
    channel: Channel.EMAIL,
    configured: true,
    provider: config.provider,
    isActive: config.isActive,
    credentialsConfigured,
    ...(fromEmail ? { fromEmail } : {}),
    ...(fromName ? { fromName } : {}),
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}
