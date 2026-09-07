import { Channel, ChannelProvider, Prisma, type ChannelConfig } from "@prisma/client";

import {
  decryptCredentials,
  encryptCredentials,
  isEncryptedCredentials,
} from "@/lib/crypto/credentials";
import { prisma } from "@/lib/db";
import type { EmailChannelConfigWriteInput } from "@/lib/validation/email-channel-config";

import { ChannelConfigValidationError } from "./errors";
import { TEST_PROVIDER_STORAGE_CREDENTIALS } from "./test-provider-storage";
import { emailResendCredentialsSchema, emailResendSettingsSchema } from "./email-types";
import {
  serializeEmailChannelConfig,
  type SafeEmailChannelConfigView,
} from "./email-serialize";

function buildTestProviderEncryptedCredentials(): string {
  return encryptCredentials(
    JSON.stringify(TEST_PROVIDER_STORAGE_CREDENTIALS),
  );
}

function hasNonEmptyValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Decrypts the existing Resend API key, if any is on file - used to preserve
 * a secret the admin didn't resend, the same "leave blank to keep" UX the
 * other channels already have for their password/apiKey fields.
 */
function existingResendApiKey(existing: ChannelConfig | null): string | null {
  if (
    !existing ||
    existing.provider !== ChannelProvider.RESEND ||
    !isEncryptedCredentials(existing.encryptedCredentials)
  ) {
    return null;
  }

  try {
    const credentials = emailResendCredentialsSchema.parse(
      JSON.parse(decryptCredentials(existing.encryptedCredentials)),
    );
    return credentials.apiKey;
  } catch {
    return null;
  }
}

function resolveEncryptedCredentialsForWrite(
  existing: ChannelConfig | null,
  input: EmailChannelConfigWriteInput,
): string {
  if (input.provider === ChannelProvider.TEST) {
    return buildTestProviderEncryptedCredentials();
  }

  const apiKey = hasNonEmptyValue(input.apiKey)
    ? input.apiKey.trim()
    : existingResendApiKey(existing);

  if (!apiKey) {
    throw new ChannelConfigValidationError("Resend API key is required");
  }

  return encryptCredentials(
    JSON.stringify(emailResendCredentialsSchema.parse({ apiKey })),
  );
}

function resolveSettingsForWrite(
  input: EmailChannelConfigWriteInput,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (input.provider === ChannelProvider.TEST) {
    return Prisma.JsonNull;
  }

  if (!input.fromEmail?.trim()) {
    throw new ChannelConfigValidationError("From email is required for Resend");
  }

  return emailResendSettingsSchema.parse({
    fromEmail: input.fromEmail.trim(),
    fromName: input.fromName?.trim() || undefined,
  });
}

async function getTenantEmailChannelConfig(
  organizationId: string,
): Promise<ChannelConfig | null> {
  return prisma.channelConfig.findUnique({
    where: {
      organizationId_channel: {
        organizationId,
        channel: Channel.EMAIL,
      },
    },
  });
}

export async function getEmailChannelConfig(
  organizationId: string,
): Promise<SafeEmailChannelConfigView> {
  const config = await getTenantEmailChannelConfig(organizationId);
  return serializeEmailChannelConfig(config);
}

export async function upsertEmailChannelConfig(
  organizationId: string,
  input: EmailChannelConfigWriteInput,
): Promise<SafeEmailChannelConfigView> {
  if (
    input.provider !== ChannelProvider.TEST &&
    input.provider !== ChannelProvider.RESEND
  ) {
    throw new ChannelConfigValidationError(
      "Configured Email provider is not supported",
    );
  }

  const existing = await getTenantEmailChannelConfig(organizationId);
  const encryptedCredentials = resolveEncryptedCredentialsForWrite(existing, input);
  const settings = resolveSettingsForWrite(input);

  const config = await prisma.channelConfig.upsert({
    where: {
      organizationId_channel: {
        organizationId,
        channel: Channel.EMAIL,
      },
    },
    create: {
      organizationId,
      channel: Channel.EMAIL,
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

  return serializeEmailChannelConfig(config);
}
