import { Channel, ChannelProvider, Prisma, type ChannelConfig } from "@prisma/client";

import { assertLiveCustomHttpAllowed } from "@/lib/abuse/live-channels";
import {
  decryptCredentials,
  encryptCredentials,
  isEncryptedCredentials,
} from "@/lib/crypto/credentials";
import { prisma } from "@/lib/db";
import { verifyLegacyHttpSmsConfiguration } from "@/lib/messaging/providers/sms/legacy-http-sms-provider";
import { ProviderSendError } from "@/lib/messaging/providers/types";
import type { SmsChannelConfigWriteInput } from "@/lib/validation/channel-config";

import {
  ChannelConfigNotFoundError,
  ChannelConfigValidationError,
  ChannelConfigVerificationError,
} from "./errors";
import { buildSmsHttpSettings, resolveSmsProviderConfig } from "./resolve";
import {
  serializeSmsChannelConfig,
  serializeSmsChannelBalanceResult,
  serializeSmsChannelVerificationResult,
  type SafeSmsChannelConfigView,
  type SmsChannelBalanceResult,
  type SmsChannelVerificationResult,
} from "./serialize";
import { smsCredentialsSchema } from "./types";
import {
  TEST_PROVIDER_STORAGE_CREDENTIALS,
} from "./test-provider-storage";

function buildTestProviderEncryptedCredentials(): string {
  return encryptCredentials(
    JSON.stringify(TEST_PROVIDER_STORAGE_CREDENTIALS),
  );
}

function canPreserveExistingPassword(existing: ChannelConfig | null): boolean {
  if (
    !existing ||
    existing.provider !== ChannelProvider.CUSTOM_HTTP ||
    !isEncryptedCredentials(existing.encryptedCredentials)
  ) {
    return false;
  }

  try {
    smsCredentialsSchema.parse(
      JSON.parse(decryptCredentials(existing.encryptedCredentials)),
    );
    return true;
  } catch {
    return false;
  }
}

function hasNonEmptyPassword(password: string | undefined): password is string {
  return typeof password === "string" && password.trim().length > 0;
}

function assertCustomHttpFields(
  input: SmsChannelConfigWriteInput,
  options: { requirePassword: boolean },
) {
  if (!input.username?.trim()) {
    throw new ChannelConfigValidationError(
      "Username is required for Custom HTTP SMS",
    );
  }

  if (!input.baseUrl?.trim() || !input.sendPath?.trim()) {
    throw new ChannelConfigValidationError(
      "Base URL and send path are required for Custom HTTP SMS",
    );
  }

  if (!input.route?.trim()) {
    throw new ChannelConfigValidationError("Route is required");
  }

  if (!input.senderId?.trim()) {
    throw new ChannelConfigValidationError("Sender ID is required");
  }

  if (options.requirePassword && !hasNonEmptyPassword(input.password)) {
    throw new ChannelConfigValidationError("Password is required");
  }
}

function encryptSmsCredentials(username: string, password: string): string {
  const credentials = smsCredentialsSchema.parse({ username, password });
  return encryptCredentials(JSON.stringify(credentials));
}

function resolveEncryptedCredentialsForWrite(
  existing: ChannelConfig | null,
  input: SmsChannelConfigWriteInput,
): string {
  if (input.provider === ChannelProvider.TEST) {
    return buildTestProviderEncryptedCredentials();
  }

  const username = input.username!.trim();
  let password: string;

  if (hasNonEmptyPassword(input.password)) {
    password = input.password.trim();
  } else if (
    existing?.provider === ChannelProvider.CUSTOM_HTTP &&
    isEncryptedCredentials(existing.encryptedCredentials)
  ) {
    try {
      const decrypted = decryptCredentials(existing.encryptedCredentials);
      const existingCredentials = smsCredentialsSchema.parse(JSON.parse(decrypted));
      password = existingCredentials.password;
    } catch {
      throw new ChannelConfigValidationError(
        "Existing SMS credentials could not be preserved",
      );
    }
  } else {
    throw new ChannelConfigValidationError("Password is required");
  }

  return encryptSmsCredentials(username, password);
}

function resolveSettingsForWrite(
  input: SmsChannelConfigWriteInput,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (input.provider === ChannelProvider.TEST) {
    return Prisma.JsonNull;
  }

  try {
    return buildSmsHttpSettings(
      input.baseUrl!,
      input.sendPath!,
      input.route!,
      input.senderId!,
      {
        requestTimeoutMs: input.requestTimeoutMs,
        successStatusCode: input.successStatusCode,
      },
    );
  } catch (error) {
    throw new ChannelConfigValidationError(
      error instanceof Error ? error.message : "Invalid SMS settings",
    );
  }
}

async function getTenantSmsChannelConfig(
  organizationId: string,
): Promise<ChannelConfig | null> {
  return prisma.channelConfig.findUnique({
    where: {
      organizationId_channel: {
        organizationId,
        channel: Channel.SMS,
      },
    },
  });
}

export async function getSmsChannelConfig(
  organizationId: string,
): Promise<SafeSmsChannelConfigView> {
  const config = await getTenantSmsChannelConfig(organizationId);
  return serializeSmsChannelConfig(config);
}

export async function upsertSmsChannelConfig(
  organizationId: string,
  input: SmsChannelConfigWriteInput,
  options: { userId?: string } = {},
): Promise<SafeSmsChannelConfigView> {
  const existing = await getTenantSmsChannelConfig(organizationId);

  if (input.provider === ChannelProvider.CUSTOM_HTTP) {
    await assertLiveCustomHttpAllowed({
      organizationId,
      userId: options.userId,
      provider: input.provider,
    });
    assertCustomHttpFields(input, {
      requirePassword: !canPreserveExistingPassword(existing),
    });
  }

  const encryptedCredentials = resolveEncryptedCredentialsForWrite(existing, input);
  const settings = resolveSettingsForWrite(input);

  const config = await prisma.channelConfig.upsert({
    where: {
      organizationId_channel: {
        organizationId,
        channel: Channel.SMS,
      },
    },
    create: {
      organizationId,
      channel: Channel.SMS,
      provider: input.provider,
      encryptedCredentials,
      settings,
      isActive: input.isActive ?? true,
    },
    update: {
      provider: input.provider,
      encryptedCredentials,
      settings,
      isActive: input.isActive ?? true,
    },
  });

  return serializeSmsChannelConfig(config);
}

async function resolveActiveCustomHttpSmsConfig(organizationId: string) {
  const config = await getTenantSmsChannelConfig(organizationId);

  if (!config) {
    throw new ChannelConfigNotFoundError();
  }

  if (!config.isActive) {
    throw new ChannelConfigVerificationError(
      "SMS channel configuration is inactive",
      "INACTIVE_CONFIGURATION",
    );
  }

  if (config.provider !== ChannelProvider.CUSTOM_HTTP) {
    throw new ChannelConfigVerificationError(
      "Configured SMS provider does not support wallet balance lookup",
      "UNSUPPORTED_PROVIDER",
    );
  }

  try {
    return {
      config,
      resolvedConfig: resolveSmsProviderConfig(config),
    };
  } catch (error) {
    if (error instanceof ProviderSendError) {
      throw new ChannelConfigVerificationError(error.message, error.code);
    }

    throw new ChannelConfigVerificationError(
      "SMS provider configuration is invalid",
      "INVALID_PROVIDER_CONFIG",
    );
  }
}

function mapSmsProviderLookupError(error: unknown): never {
  if (error instanceof ProviderSendError) {
    throw new ChannelConfigVerificationError(error.message, error.code);
  }

  if (error instanceof Error && error.name === "DeliveryStatusLookupError") {
    const lookupError = error as Error & { code?: string };
    throw new ChannelConfigVerificationError(
      lookupError.message,
      lookupError.code ?? "VERIFICATION_FAILED",
    );
  }

  throw new ChannelConfigVerificationError(
    "SMS provider wallet balance lookup failed",
    "BALANCE_LOOKUP_FAILED",
  );
}

export async function getSmsChannelBalance(
  organizationId: string,
  options: { fetchFn?: typeof fetch } = {},
): Promise<SmsChannelBalanceResult> {
  const config = await getTenantSmsChannelConfig(organizationId);

  if (!config) {
    throw new ChannelConfigNotFoundError();
  }

  if (config.provider === ChannelProvider.TEST) {
    return serializeSmsChannelBalanceResult(
      ChannelProvider.TEST,
      "Test provider has no live SMS wallet balance",
      {
        walletBalanceSupported: false,
        balanceCredits: null,
      },
    );
  }

  const { resolvedConfig } = await resolveActiveCustomHttpSmsConfig(
    organizationId,
  );

  try {
    const { balanceCredits } = await verifyLegacyHttpSmsConfiguration({
      ...resolvedConfig,
      fetchFn: options.fetchFn,
    });

    return serializeSmsChannelBalanceResult(
      ChannelProvider.CUSTOM_HTTP,
      balanceCredits === null
        ? "SMS provider credentials are valid, but no wallet balance was returned"
        : `SMS wallet balance: ${balanceCredits} credits`,
      {
        walletBalanceSupported: true,
        balanceCredits,
      },
    );
  } catch (error) {
    mapSmsProviderLookupError(error);
  }
}

export async function verifySmsChannelConfig(
  organizationId: string,
  options: { fetchFn?: typeof fetch } = {},
): Promise<SmsChannelVerificationResult> {
  const config = await getTenantSmsChannelConfig(organizationId);

  if (!config) {
    throw new ChannelConfigNotFoundError();
  }

  if (!config.isActive) {
    throw new ChannelConfigVerificationError(
      "SMS channel configuration is inactive",
      "INACTIVE_CONFIGURATION",
    );
  }

  if (config.provider === ChannelProvider.TEST) {
    return serializeSmsChannelVerificationResult(
      ChannelProvider.TEST,
      "Test provider configuration is ready",
      {
        walletBalanceSupported: false,
        balanceCredits: null,
      },
    );
  }

  if (config.provider !== ChannelProvider.CUSTOM_HTTP) {
    throw new ChannelConfigVerificationError(
      "Configured SMS provider does not support verification",
      "UNSUPPORTED_PROVIDER",
    );
  }

  const { resolvedConfig } = await resolveActiveCustomHttpSmsConfig(
    organizationId,
  );

  try {
    const { balanceCredits } = await verifyLegacyHttpSmsConfiguration({
      ...resolvedConfig,
      fetchFn: options.fetchFn,
    });

    return serializeSmsChannelVerificationResult(
      ChannelProvider.CUSTOM_HTTP,
      balanceCredits === null
        ? "SMS provider credentials verified successfully"
        : `SMS provider credentials verified. Wallet balance: ${balanceCredits} credits`,
      {
        walletBalanceSupported: true,
        balanceCredits,
      },
    );
  } catch (error) {
    mapSmsProviderLookupError(error);
  }
}
