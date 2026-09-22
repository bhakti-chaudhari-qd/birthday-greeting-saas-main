import { Channel, ChannelProvider, Prisma, type ChannelConfig } from "@prisma/client";

import {
  assertLiveCustomHttpAllowed,
  assertWhatsAppTlsAllowed,
} from "@/lib/abuse/live-channels";
import {
  decryptCredentials,
  encryptCredentials,
  isEncryptedCredentials,
} from "@/lib/crypto/credentials";
import { prisma } from "@/lib/db";
import type { WhatsAppChannelConfigWriteInput } from "@/lib/validation/whatsapp-channel-config";

import { ChannelConfigValidationError } from "./errors";
import { TEST_PROVIDER_STORAGE_CREDENTIALS } from "./test-provider-storage";
import { buildWhatsAppHttpSettings } from "./whatsapp-resolve";
import {
  serializeWhatsAppChannelConfig,
  type SafeWhatsAppChannelConfigView,
} from "./whatsapp-serialize";
import {
  decodeWhatsAppMediaBase64,
  defaultFilenameForMediaType,
  stripWhatsAppMediaDataUrlPrefix,
  whatsappHttpCredentialsSchema,
  whatsappHttpSettingsSchema,
  whatsappMetaCredentialsSchema,
  whatsappMetaSettingsSchema,
  whatsappTestSettingsSchema,
  type WhatsAppMediaContentType,
} from "./whatsapp-types";

function buildTestProviderEncryptedCredentials(): string {
  return encryptCredentials(
    JSON.stringify(TEST_PROVIDER_STORAGE_CREDENTIALS),
  );
}

function hasNonEmptyValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Decrypts and parses the existing Custom HTTP credentials, if any are on
 * file and still valid against the current schema. Used both to preserve a
 * secret the admin didn't resend (password/apiKey - matches the existing
 * "leave blank to keep" UX) and to allow omitting credentials entirely on
 * writes that only touch unrelated fields (e.g. tlsInsecure).
 */
function existingWhatsAppCredentials(
  existing: ChannelConfig | null,
): { username?: string; password: string; apiKey?: string } | null {
  if (
    !existing ||
    existing.provider !== ChannelProvider.CUSTOM_HTTP ||
    !isEncryptedCredentials(existing.encryptedCredentials)
  ) {
    return null;
  }

  try {
    return whatsappHttpCredentialsSchema.parse(
      JSON.parse(decryptCredentials(existing.encryptedCredentials)),
    );
  } catch {
    return null;
  }
}

function encryptWhatsAppCredentials(credentials: {
  username?: string;
  password: string;
  apiKey?: string;
}): string {
  return encryptCredentials(
    JSON.stringify(whatsappHttpCredentialsSchema.parse(credentials)),
  );
}

/** Same "leave blank to keep" UX as Custom HTTP's password, for the Meta access token. */
function existingWhatsAppMetaCredentials(
  existing: ChannelConfig | null,
): { accessToken: string } | null {
  if (
    !existing ||
    existing.provider !== ChannelProvider.META ||
    !isEncryptedCredentials(existing.encryptedCredentials)
  ) {
    return null;
  }

  try {
    return whatsappMetaCredentialsSchema.parse(
      JSON.parse(decryptCredentials(existing.encryptedCredentials)),
    );
  } catch {
    return null;
  }
}

function encryptWhatsAppMetaCredentials(credentials: {
  accessToken: string;
}): string {
  return encryptCredentials(
    JSON.stringify(whatsappMetaCredentialsSchema.parse(credentials)),
  );
}

/**
 * Username/password and API-key are two mutually exclusive Custom HTTP auth
 * modes, chosen by which field the request actually supplies. Whichever
 * secret isn't resent (password when in username mode, or the whole
 * credential when neither is resent) falls back to what's already on file -
 * the same "omit to keep unchanged" UX the password field already had.
 */
function resolveEncryptedCredentialsForWrite(
  existing: ChannelConfig | null,
  input: WhatsAppChannelConfigWriteInput,
): string {
  if (input.provider === ChannelProvider.TEST) {
    return buildTestProviderEncryptedCredentials();
  }

  if (input.provider === ChannelProvider.META) {
    if (hasNonEmptyValue(input.accessToken)) {
      return encryptWhatsAppMetaCredentials({
        accessToken: input.accessToken.trim(),
      });
    }

    const existingMetaCredentials = existingWhatsAppMetaCredentials(existing);
    if (existingMetaCredentials) {
      return encryptWhatsAppMetaCredentials(existingMetaCredentials);
    }

    throw new ChannelConfigValidationError(
      "Access token is required for Meta Cloud API WhatsApp",
    );
  }

  const existingCredentials = existingWhatsAppCredentials(existing);

  if (hasNonEmptyValue(input.apiKey)) {
    return encryptWhatsAppCredentials({
      apiKey: input.apiKey.trim(),
      password: "",
    });
  }

  if (hasNonEmptyValue(input.username)) {
    const password = hasNonEmptyValue(input.password)
      ? input.password.trim()
      : (existingCredentials?.username && existingCredentials.password) || "";
    return encryptWhatsAppCredentials({
      username: input.username.trim(),
      password,
    });
  }

  if (existingCredentials) {
    return encryptWhatsAppCredentials(existingCredentials);
  }

  throw new ChannelConfigValidationError(
    "Username or API key is required for Custom HTTP WhatsApp",
  );
}

function resolveSettingsForWrite(
  existing: ChannelConfig | null,
  input: WhatsAppChannelConfigWriteInput,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (input.provider === ChannelProvider.TEST) {
    if (input.clearMedia) {
      return Prisma.JsonNull;
    }

    if (input.mediaBase64?.trim()) {
      let decoded;
      try {
        decoded = decodeWhatsAppMediaBase64(input.mediaBase64);
      } catch (error) {
        throw new ChannelConfigValidationError(
          error instanceof Error ? error.message : "Invalid WhatsApp media",
        );
      }

      const contentType = input.mediaContentType ?? decoded.contentType;
      return whatsappTestSettingsSchema.parse({
        mediaBase64: stripWhatsAppMediaDataUrlPrefix(input.mediaBase64),
        mediaFilename: (
          input.mediaFilename ?? defaultFilenameForMediaType(contentType)
        ).trim(),
        mediaContentType: contentType,
      });
    }

    if (existing?.provider === ChannelProvider.TEST && existing.settings) {
      try {
        return whatsappTestSettingsSchema.parse(existing.settings);
      } catch {
        return Prisma.JsonNull;
      }
    }

    return Prisma.JsonNull;
  }

  if (input.provider === ChannelProvider.META) {
    if (!input.phoneNumberId?.trim()) {
      throw new ChannelConfigValidationError(
        "Phone number ID is required for Meta Cloud API WhatsApp",
      );
    }

    let existingMetaMedia:
      | {
          mediaBase64: string;
          mediaFilename: string;
          mediaContentType?: WhatsAppMediaContentType;
        }
      | null = null;

    if (existing?.provider === ChannelProvider.META && existing.settings) {
      try {
        const parsed = whatsappMetaSettingsSchema.parse(existing.settings);
        if (
          !input.clearMedia &&
          parsed.mediaBase64?.trim() &&
          parsed.mediaFilename?.trim()
        ) {
          existingMetaMedia = {
            mediaBase64: parsed.mediaBase64,
            mediaFilename: parsed.mediaFilename,
            mediaContentType: parsed.mediaContentType,
          };
        }
      } catch {
        existingMetaMedia = null;
      }
    }

    let metaMedia = existingMetaMedia;

    if (input.clearMedia) {
      metaMedia = null;
    } else if (input.mediaBase64?.trim()) {
      let decoded;
      try {
        decoded = decodeWhatsAppMediaBase64(input.mediaBase64);
      } catch (error) {
        throw new ChannelConfigValidationError(
          error instanceof Error ? error.message : "Invalid WhatsApp media",
        );
      }

      const contentType = input.mediaContentType ?? decoded.contentType;
      metaMedia = {
        mediaBase64: stripWhatsAppMediaDataUrlPrefix(input.mediaBase64),
        mediaFilename: (
          input.mediaFilename ?? defaultFilenameForMediaType(contentType)
        ).trim(),
        mediaContentType: contentType,
      };
    }

    return whatsappMetaSettingsSchema.parse({
      phoneNumberId: input.phoneNumberId.trim(),
      ...(input.apiVersion?.trim()
        ? { apiVersion: input.apiVersion.trim() }
        : {}),
      ...(metaMedia ?? {}),
    });
  }

  if (!input.baseUrl?.trim() || !input.sendPath?.trim()) {
    throw new ChannelConfigValidationError(
      "Base URL and send path are required for Custom HTTP WhatsApp",
    );
  }

  let existingTlsInsecure = false;
  let existingMedia:
    | {
        mediaBase64: string;
        mediaFilename: string;
        mediaContentType?: WhatsAppMediaContentType;
      }
    | null = null;

  if (
    existing?.provider === ChannelProvider.CUSTOM_HTTP &&
    existing.settings
  ) {
    try {
      const parsed = whatsappHttpSettingsSchema.parse(existing.settings);
      existingTlsInsecure = parsed.tlsInsecure === true;
      if (
        !input.clearMedia &&
        parsed.mediaBase64?.trim() &&
        parsed.mediaFilename?.trim()
      ) {
        existingMedia = {
          mediaBase64: parsed.mediaBase64,
          mediaFilename: parsed.mediaFilename,
          mediaContentType: parsed.mediaContentType,
        };
      }
    } catch {
      existingMedia = null;
    }
  }

  let media = existingMedia;

  if (input.clearMedia) {
    media = null;
  } else if (input.mediaBase64?.trim()) {
    let decoded;
    try {
      decoded = decodeWhatsAppMediaBase64(input.mediaBase64);
    } catch (error) {
      throw new ChannelConfigValidationError(
        error instanceof Error ? error.message : "Invalid WhatsApp media",
      );
    }

    const contentType =
      input.mediaContentType ?? decoded.contentType;

    media = {
      mediaBase64: stripWhatsAppMediaDataUrlPrefix(input.mediaBase64),
      mediaFilename: (
        input.mediaFilename ?? defaultFilenameForMediaType(contentType)
      ).trim(),
      mediaContentType: contentType,
    };
  }

  const tlsInsecure =
    typeof input.tlsInsecure === "boolean"
      ? input.tlsInsecure
      : existingTlsInsecure;

  assertWhatsAppTlsAllowed(tlsInsecure);

  try {
    return buildWhatsAppHttpSettings(
      input.baseUrl,
      input.sendPath,
      media,
      tlsInsecure,
    );
  } catch (error) {
    throw new ChannelConfigValidationError(
      error instanceof Error ? error.message : "Invalid WhatsApp settings",
    );
  }
}

async function getTenantWhatsAppChannelConfig(organizationId: string) {
  return prisma.channelConfig.findUnique({
    where: {
      organizationId_channel: {
        organizationId,
        channel: Channel.WHATSAPP,
      },
    },
  });
}

export async function getWhatsAppChannelConfig(
  organizationId: string,
): Promise<SafeWhatsAppChannelConfigView> {
  const config = await getTenantWhatsAppChannelConfig(organizationId);
  return serializeWhatsAppChannelConfig(config);
}

export async function upsertWhatsAppChannelConfig(
  organizationId: string,
  input: WhatsAppChannelConfigWriteInput,
  options: { userId?: string } = {},
): Promise<SafeWhatsAppChannelConfigView> {
  if (
    input.provider !== ChannelProvider.TEST &&
    input.provider !== ChannelProvider.CUSTOM_HTTP &&
    input.provider !== ChannelProvider.META
  ) {
    throw new ChannelConfigValidationError(
      "Configured WhatsApp provider is not supported",
    );
  }

  if (
    input.provider === ChannelProvider.CUSTOM_HTTP ||
    input.provider === ChannelProvider.META
  ) {
    await assertLiveCustomHttpAllowed({
      organizationId,
      userId: options.userId,
      provider: input.provider,
    });
  }

  if (input.provider === ChannelProvider.CUSTOM_HTTP) {
    if (!input.baseUrl?.trim() || !input.sendPath?.trim()) {
      throw new ChannelConfigValidationError(
        "Base URL and send path are required for Custom HTTP WhatsApp",
      );
    }
  }

  if (input.provider === ChannelProvider.META) {
    if (!input.phoneNumberId?.trim()) {
      throw new ChannelConfigValidationError(
        "Phone number ID is required for Meta Cloud API WhatsApp",
      );
    }
  }

  const existing = await getTenantWhatsAppChannelConfig(organizationId);
  // Validates username/apiKey requiredness itself, accounting for an
  // existing on-file credential when neither is resent in this request.
  const encryptedCredentials = resolveEncryptedCredentialsForWrite(
    existing,
    input,
  );
  const settings = resolveSettingsForWrite(existing, input);

  const config = await prisma.channelConfig.upsert({
    where: {
      organizationId_channel: {
        organizationId,
        channel: Channel.WHATSAPP,
      },
    },
    create: {
      organizationId,
      channel: Channel.WHATSAPP,
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

  return serializeWhatsAppChannelConfig(config);
}

/**
 * Replace the WhatsApp media file (JPEG or short video).
 * TEST stores it for local simulation; CUSTOM_HTTP attaches it to live sends.
 */
export async function updateWhatsAppChannelMedia(
  organizationId: string,
  media: {
    mediaBase64: string;
    mediaFilename: string;
    mediaContentType?: WhatsAppMediaContentType;
  },
): Promise<SafeWhatsAppChannelConfigView> {
  const existing = await getTenantWhatsAppChannelConfig(organizationId);

  if (
    !existing ||
    (existing.provider !== ChannelProvider.TEST &&
      existing.provider !== ChannelProvider.CUSTOM_HTTP &&
      existing.provider !== ChannelProvider.META)
  ) {
    throw new ChannelConfigValidationError(
      "Configure WhatsApp in Settings before applying media",
    );
  }

  let decoded;
  try {
    decoded = decodeWhatsAppMediaBase64(media.mediaBase64);
  } catch (error) {
    throw new ChannelConfigValidationError(
      error instanceof Error ? error.message : "Invalid WhatsApp media",
    );
  }

  const contentType = media.mediaContentType ?? decoded.contentType;
  const storedMedia = {
    mediaBase64: stripWhatsAppMediaDataUrlPrefix(media.mediaBase64),
    mediaFilename: media.mediaFilename.trim(),
    mediaContentType: contentType,
  };

  let nextSettings: Prisma.InputJsonValue;
  if (existing.provider === ChannelProvider.TEST) {
    nextSettings = whatsappTestSettingsSchema.parse(storedMedia);
  } else if (existing.provider === ChannelProvider.META) {
    let settings: ReturnType<typeof whatsappMetaSettingsSchema.parse>;
    try {
      settings = whatsappMetaSettingsSchema.parse(existing.settings ?? {});
    } catch {
      throw new ChannelConfigValidationError(
        "WhatsApp Meta Cloud API settings are incomplete. Save the phone number ID first.",
      );
    }

    nextSettings = whatsappMetaSettingsSchema.parse({
      phoneNumberId: settings.phoneNumberId,
      ...(settings.apiVersion ? { apiVersion: settings.apiVersion } : {}),
      ...storedMedia,
    });
  } else {
    let settings: ReturnType<typeof whatsappHttpSettingsSchema.parse>;
    try {
      settings = whatsappHttpSettingsSchema.parse(existing.settings ?? {});
    } catch {
      throw new ChannelConfigValidationError(
        "WhatsApp Custom HTTP settings are incomplete. Save base URL and send path first.",
      );
    }

    nextSettings = buildWhatsAppHttpSettings(
      settings.baseUrl,
      settings.sendPath,
      storedMedia,
      settings.tlsInsecure === true,
    );
  }

  const config = await prisma.channelConfig.update({
    where: { id: existing.id },
    data: { settings: nextSettings },
  });

  return serializeWhatsAppChannelConfig(config);
}

export async function requireActiveWhatsAppChannelConfig(
  organizationId: string,
) {
  const config = await getTenantWhatsAppChannelConfig(organizationId);

  if (!config || !config.isActive) {
    throw new ChannelConfigValidationError(
      "WhatsApp channel must be configured before sending",
    );
  }

  if (
    config.provider !== ChannelProvider.TEST &&
    config.provider !== ChannelProvider.CUSTOM_HTTP
  ) {
    throw new ChannelConfigValidationError(
      "Configured WhatsApp provider is not supported",
    );
  }

  return config;
}

/** @deprecated Use requireActiveWhatsAppChannelConfig */
export async function requireActiveWhatsAppTestChannelConfig(
  organizationId: string,
) {
  const config = await requireActiveWhatsAppChannelConfig(organizationId);

  if (config.provider !== ChannelProvider.TEST) {
    throw new ChannelConfigValidationError(
      "WhatsApp channel must be configured with the TEST provider before sending",
    );
  }

  return config;
}
