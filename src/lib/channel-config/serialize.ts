import { Channel, ChannelProvider, type ChannelConfig } from "@prisma/client";

import {
  decryptCredentials,
  isEncryptedCredentials,
} from "@/lib/crypto/credentials";

import { smsCredentialsSchema, smsSettingsSchema } from "./types";

export type SafeSmsChannelConfigView = {
  channel: typeof Channel.SMS;
  configured: boolean;
  provider: ChannelProvider | null;
  isActive: boolean;
  credentialsConfigured: boolean;
  username?: string;
  baseUrl?: string;
  sendPath?: string;
  route?: string;
  senderId?: string;
  requestTimeoutMs?: number;
  successStatusCode?: number;
  createdAt?: string;
  updatedAt?: string;
  verificationSupported: boolean;
  /** Live wallet lookup is available for Custom HTTP SMS providers. */
  walletBalanceSupported: boolean;
};

function safeUsernameFromConfig(config: ChannelConfig): string | undefined {
  if (config.provider !== ChannelProvider.CUSTOM_HTTP) {
    return undefined;
  }

  if (!isEncryptedCredentials(config.encryptedCredentials)) {
    return undefined;
  }

  try {
    const credentials = smsCredentialsSchema.parse(
      JSON.parse(decryptCredentials(config.encryptedCredentials)),
    );
    return credentials.username;
  } catch {
    return undefined;
  }
}

function safeSettingsFromConfig(config: ChannelConfig): {
  baseUrl?: string;
  sendPath?: string;
  route?: string;
  senderId?: string;
  requestTimeoutMs?: number;
  successStatusCode?: number;
} {
  if (config.provider !== ChannelProvider.CUSTOM_HTTP) {
    return {};
  }

  try {
    const settings = smsSettingsSchema.parse(config.settings ?? {});
    return {
      baseUrl: settings.baseUrl,
      sendPath: settings.sendPath,
      route: settings.route,
      senderId: settings.senderId,
      requestTimeoutMs: settings.requestTimeoutMs,
      successStatusCode: settings.successStatusCode,
    };
  } catch {
    return {};
  }
}

export function serializeSmsChannelConfig(
  config: ChannelConfig | null,
): SafeSmsChannelConfigView {
  if (!config) {
    return {
      channel: Channel.SMS,
      configured: false,
      provider: null,
      isActive: false,
      credentialsConfigured: false,
      verificationSupported: true,
      walletBalanceSupported: false,
    };
  }

  const username = safeUsernameFromConfig(config);
  const settings = safeSettingsFromConfig(config);
  const isCustomHttp = config.provider === ChannelProvider.CUSTOM_HTTP;

  return {
    channel: Channel.SMS,
    configured: true,
    provider: config.provider,
    isActive: config.isActive,
    credentialsConfigured: isCustomHttp && Boolean(username),
    ...(isCustomHttp && username ? { username } : {}),
    ...(isCustomHttp && settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
    ...(isCustomHttp && settings.sendPath ? { sendPath: settings.sendPath } : {}),
    ...(isCustomHttp && settings.route ? { route: settings.route } : {}),
    ...(isCustomHttp && settings.senderId ? { senderId: settings.senderId } : {}),
    ...(isCustomHttp && settings.requestTimeoutMs
      ? { requestTimeoutMs: settings.requestTimeoutMs }
      : {}),
    ...(isCustomHttp && settings.successStatusCode !== undefined
      ? { successStatusCode: settings.successStatusCode }
      : {}),
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
    verificationSupported: true,
    walletBalanceSupported: isCustomHttp,
  };
}

export type SmsChannelVerificationResult = {
  verified: boolean;
  provider: ChannelProvider;
  message: string;
  walletBalanceSupported: boolean;
  balanceCredits: number | null;
};

export type SmsChannelBalanceResult = {
  provider: ChannelProvider;
  walletBalanceSupported: boolean;
  balanceCredits: number | null;
  message: string;
};

export function serializeSmsChannelVerificationResult(
  provider: ChannelProvider,
  message: string,
  options: {
    walletBalanceSupported: boolean;
    balanceCredits: number | null;
  },
): SmsChannelVerificationResult {
  return {
    verified: true,
    provider,
    message,
    walletBalanceSupported: options.walletBalanceSupported,
    balanceCredits: options.balanceCredits,
  };
}

export function serializeSmsChannelBalanceResult(
  provider: ChannelProvider,
  message: string,
  options: {
    walletBalanceSupported: boolean;
    balanceCredits: number | null;
  },
): SmsChannelBalanceResult {
  return {
    provider,
    message,
    walletBalanceSupported: options.walletBalanceSupported,
    balanceCredits: options.balanceCredits,
  };
}
