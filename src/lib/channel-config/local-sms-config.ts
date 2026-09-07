import { Channel, ChannelProvider } from "@prisma/client";

import { encryptCredentials } from "@/lib/crypto/credentials";
import {
  buildSmsHttpSettings,
  DEFAULT_SMS_REQUEST_TIMEOUT_MS,
} from "@/lib/channel-config/resolve";
import { smsCredentialsSchema } from "@/lib/channel-config/types";

/**
 * Local script helper defaults only - not product runtime defaults.
 * Prefer SMS_BASE_URL / SMS_SEND_PATH from the environment.
 */
export const LOCAL_SMS_PROVIDER_SETTINGS = {
  baseUrl: "https://sms-provider.example",
  sendPath: "/send.aspx",
  route: "trans1",
  senderId: "QDTECH",
  requestTimeoutMs: DEFAULT_SMS_REQUEST_TIMEOUT_MS,
} as const;

export type LocalSmsEnvInput = {
  smsUsername: string;
  smsPassword: string;
  credentialsEncryptionKey: string;
  smsBaseUrl: string;
  smsSendPath: string;
  smsRoute: string;
  smsSenderId: string;
  organizationId?: string;
  organizationSlug?: string;
};

export type LocalSmsChannelConfigInput = {
  channel: typeof Channel.SMS;
  provider: typeof ChannelProvider.CUSTOM_HTTP;
  encryptedCredentials: string;
  settings: {
    baseUrl: string;
    sendPath: string;
    route: string;
    senderId: string;
    requestTimeoutMs: number;
  };
  isActive: true;
};

export class LocalSmsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalSmsConfigError";
  }
}

export function readLocalSmsEnv(
  env: Record<string, string | undefined> = process.env,
): LocalSmsEnvInput {
  const smsUsername = env.SMS_USERNAME?.trim();
  const smsPassword = env.SMS_PASSWORD;
  const credentialsEncryptionKey = env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  const organizationId = env.SMS_CONFIG_ORGANIZATION_ID?.trim();
  const organizationSlug = env.SMS_CONFIG_ORGANIZATION_SLUG?.trim();
  const smsBaseUrl = env.SMS_BASE_URL?.trim();
  const smsSendPath =
    env.SMS_SEND_PATH?.trim() || LOCAL_SMS_PROVIDER_SETTINGS.sendPath;
  const smsRoute = env.SMS_ROUTE?.trim() || LOCAL_SMS_PROVIDER_SETTINGS.route;
  const smsSenderId =
    env.SMS_SENDER_ID?.trim() || LOCAL_SMS_PROVIDER_SETTINGS.senderId;

  if (!smsUsername || !smsPassword) {
    throw new LocalSmsConfigError(
      "SMS_USERNAME and SMS_PASSWORD must be set in the local environment",
    );
  }

  if (!credentialsEncryptionKey) {
    throw new LocalSmsConfigError(
      "CREDENTIALS_ENCRYPTION_KEY must be set in the local environment",
    );
  }

  if (!smsBaseUrl) {
    throw new LocalSmsConfigError(
      "SMS_BASE_URL must be set for Custom HTTP SMS (no product-default vendor URL)",
    );
  }

  if (!organizationId && !organizationSlug) {
    throw new LocalSmsConfigError(
      "Set SMS_CONFIG_ORGANIZATION_ID or SMS_CONFIG_ORGANIZATION_SLUG for the target development organization",
    );
  }

  if (organizationId && organizationSlug) {
    throw new LocalSmsConfigError(
      "Set only one of SMS_CONFIG_ORGANIZATION_ID or SMS_CONFIG_ORGANIZATION_SLUG",
    );
  }

  return {
    smsUsername,
    smsPassword,
    credentialsEncryptionKey,
    smsBaseUrl,
    smsSendPath,
    smsRoute,
    smsSenderId,
    organizationId,
    organizationSlug,
  };
}

export function buildLocalSmsChannelConfig(
  input: LocalSmsEnvInput,
): LocalSmsChannelConfigInput {
  const previousKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  process.env.CREDENTIALS_ENCRYPTION_KEY = input.credentialsEncryptionKey;

  try {
    const credentials = smsCredentialsSchema.parse({
      username: input.smsUsername,
      password: input.smsPassword,
    });
    const encryptedCredentials = encryptCredentials(
      JSON.stringify(credentials),
    );
    const settings = {
      ...buildSmsHttpSettings(
        input.smsBaseUrl,
        input.smsSendPath,
        input.smsRoute,
        input.smsSenderId,
      ),
      requestTimeoutMs: DEFAULT_SMS_REQUEST_TIMEOUT_MS,
    };

    return {
      channel: Channel.SMS,
      provider: ChannelProvider.CUSTOM_HTTP,
      encryptedCredentials,
      settings,
      isActive: true,
    };
  } finally {
    if (previousKey === undefined) {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    } else {
      process.env.CREDENTIALS_ENCRYPTION_KEY = previousKey;
    }
  }
}

export function isEncryptedStoredCredentials(value: string): boolean {
  return value.startsWith("enc:v1:");
}
