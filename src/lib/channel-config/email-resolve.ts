import type { ChannelConfig } from "@prisma/client";
import { ChannelProvider } from "@prisma/client";

import { decryptCredentials } from "@/lib/crypto/credentials";
import { ProviderSendError } from "@/lib/messaging/providers/types";

import {
  emailResendCredentialsSchema,
  emailResendSettingsSchema,
  type ResolvedEmailProviderConfig,
} from "./email-types";

export function resolveEmailProviderConfig(
  channelConfig: ChannelConfig,
): ResolvedEmailProviderConfig {
  if (channelConfig.provider !== ChannelProvider.RESEND) {
    throw new ProviderSendError(
      "Email provider configuration is not supported for this provider",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  let decrypted: string;

  try {
    decrypted = decryptCredentials(channelConfig.encryptedCredentials);
  } catch {
    throw new ProviderSendError(
      "Email provider credentials could not be decrypted",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  let credentials;

  try {
    credentials = emailResendCredentialsSchema.parse(JSON.parse(decrypted));
  } catch {
    throw new ProviderSendError(
      "Email provider credentials are invalid",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  let settings;

  try {
    settings = emailResendSettingsSchema.parse(channelConfig.settings ?? {});
  } catch {
    throw new ProviderSendError(
      "Email provider requires a From email in channel settings",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  return {
    apiKey: credentials.apiKey,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
  };
}
