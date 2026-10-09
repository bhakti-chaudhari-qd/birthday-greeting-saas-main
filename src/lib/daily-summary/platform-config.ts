import { z } from "zod";

import { WHATSAPP_META_DEFAULT_API_VERSION } from "@/lib/channel-config/whatsapp-types";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto/credentials";
import { prisma } from "@/lib/db";

const CONFIG_ID = "default";
export const DEFAULT_DAILY_SUMMARY_SEND_HOUR = 9;

/** Everything needed to send a summary, access token decrypted. */
export type DailySummaryConfig = {
  /** The platform's own Meta Cloud API account the summary is sent from. */
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  templateName: string;
  language: string;
  /** Hour of day (IST, 0-23) from which the previous day's summary goes out. */
  sendHour: number;
};

/** What the Platform Admin settings screen sees - never the access token itself. */
export type PlatformDailySummarySettings = {
  configured: boolean;
  enabled: boolean;
  phoneNumberId: string;
  apiVersion: string;
  templateName: string;
  language: string;
  sendHour: number;
};

export class PlatformDailySummaryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformDailySummaryConfigError";
  }
}

export const updatePlatformDailySummarySchema = z
  .object({
    enabled: z.boolean(),
    /** Omit to keep the stored token; required the first time. */
    accessToken: z.string().trim().min(1).max(2000).optional(),
    phoneNumberId: z.string().trim().regex(/^\d{5,30}$/, "Phone number ID must be digits only"),
    apiVersion: z
      .string()
      .trim()
      .regex(/^v\d+(\.\d+)?$/, "API version must look like v21.0")
      .optional(),
    templateName: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]{1,512}$/, "Template name uses lowercase letters, numbers and underscores"),
    language: z.string().trim().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, "Language looks like en or en_US"),
    sendHour: z.number().int().min(0).max(23),
  })
  .strict();

export type UpdatePlatformDailySummaryInput = z.infer<
  typeof updatePlatformDailySummarySchema
>;

/**
 * The summary is sent as an approved WhatsApp template from the platform's
 * own Meta Cloud API account, never a client's gateway. Null (summary off)
 * until a Platform Admin saves that account under Admin > Settings, or while
 * it is switched off there.
 */
export async function loadDailySummaryConfig(): Promise<DailySummaryConfig | null> {
  const row = await prisma.platformDailySummaryConfig.findUnique({
    where: { id: CONFIG_ID },
  });
  if (!row || !row.isEnabled) {
    return null;
  }

  return {
    accessToken: decryptCredentials(row.encryptedAccessToken),
    phoneNumberId: row.phoneNumberId,
    apiVersion: row.apiVersion,
    templateName: row.templateName,
    language: row.language,
    sendHour: row.sendHour,
  };
}

export async function getPlatformDailySummarySettings(): Promise<PlatformDailySummarySettings> {
  const row = await prisma.platformDailySummaryConfig.findUnique({
    where: { id: CONFIG_ID },
  });

  return {
    configured: Boolean(row),
    enabled: row?.isEnabled ?? true,
    phoneNumberId: row?.phoneNumberId ?? "",
    apiVersion: row?.apiVersion ?? WHATSAPP_META_DEFAULT_API_VERSION,
    templateName: row?.templateName ?? "",
    language: row?.language ?? "en",
    sendHour: row?.sendHour ?? DEFAULT_DAILY_SUMMARY_SEND_HOUR,
  };
}

export async function updatePlatformDailySummarySettings(
  input: UpdatePlatformDailySummaryInput,
): Promise<PlatformDailySummarySettings> {
  const existing = await prisma.platformDailySummaryConfig.findUnique({
    where: { id: CONFIG_ID },
    select: { id: true },
  });
  if (!existing && !input.accessToken) {
    throw new PlatformDailySummaryConfigError("Access token is required");
  }

  const fields = {
    isEnabled: input.enabled,
    phoneNumberId: input.phoneNumberId,
    apiVersion: input.apiVersion ?? WHATSAPP_META_DEFAULT_API_VERSION,
    templateName: input.templateName,
    language: input.language,
    sendHour: input.sendHour,
    ...(input.accessToken
      ? { encryptedAccessToken: encryptCredentials(input.accessToken) }
      : {}),
  };

  if (existing) {
    await prisma.platformDailySummaryConfig.update({
      where: { id: CONFIG_ID },
      data: fields,
    });
  } else {
    await prisma.platformDailySummaryConfig.create({
      data: {
        id: CONFIG_ID,
        ...fields,
        encryptedAccessToken: encryptCredentials(input.accessToken!),
      },
    });
  }

  return getPlatformDailySummarySettings();
}
