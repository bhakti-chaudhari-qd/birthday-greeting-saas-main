import { z } from "zod";

import { decryptCredentials } from "@/lib/crypto/credentials";
import { prisma } from "@/lib/db";

const CONFIG_ID = "default";
export const DEFAULT_TOMORROW_LIST_SEND_HOUR = 20;

/**
 * Everything needed to send Tomorrow's List. It goes out from the same Meta
 * Cloud API account as the daily summary (saved under Admin > Settings >
 * Daily Summary), with its own approved template.
 */
export type TomorrowListConfig = {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  templateName: string;
  language: string;
  /** Default IST hour (0-23) on the day before, for clients who have not chosen one. */
  sendHour: number;
};

/** What the Platform Admin settings screen sees. */
export type PlatformTomorrowListSettings = {
  /** False until the Meta account is saved under Daily Summary. */
  accountConfigured: boolean;
  enabled: boolean;
  templateName: string;
  language: string;
  sendHour: number;
};

export class PlatformTomorrowListConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformTomorrowListConfigError";
  }
}

export const updatePlatformTomorrowListSchema = z
  .object({
    enabled: z.boolean(),
    templateName: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]{1,512}$/, "Template name uses lowercase letters, numbers and underscores"),
    language: z.string().trim().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, "Language looks like en or en_US"),
    sendHour: z.number().int().min(0).max(23),
  })
  .strict();

export type UpdatePlatformTomorrowListInput = z.infer<
  typeof updatePlatformTomorrowListSchema
>;

/**
 * Null (nothing is sent) until the Meta account and the template are saved
 * and Tomorrow's List is switched on. Independent of the daily summary's own
 * on/off switch - only the account is shared.
 */
export async function loadTomorrowListConfig(): Promise<TomorrowListConfig | null> {
  const row = await prisma.platformDailySummaryConfig.findUnique({
    where: { id: CONFIG_ID },
  });
  if (!row || !row.tomorrowListEnabled || !row.tomorrowListTemplateName) {
    return null;
  }

  return {
    accessToken: decryptCredentials(row.encryptedAccessToken),
    phoneNumberId: row.phoneNumberId,
    apiVersion: row.apiVersion,
    templateName: row.tomorrowListTemplateName,
    language: row.tomorrowListLanguage,
    sendHour: row.tomorrowListSendHour,
  };
}

export async function getPlatformTomorrowListSettings(): Promise<PlatformTomorrowListSettings> {
  const row = await prisma.platformDailySummaryConfig.findUnique({
    where: { id: CONFIG_ID },
    select: {
      tomorrowListEnabled: true,
      tomorrowListTemplateName: true,
      tomorrowListLanguage: true,
      tomorrowListSendHour: true,
    },
  });

  return {
    accountConfigured: Boolean(row),
    enabled: row?.tomorrowListEnabled ?? false,
    templateName: row?.tomorrowListTemplateName ?? "",
    language: row?.tomorrowListLanguage ?? "en",
    sendHour: row?.tomorrowListSendHour ?? DEFAULT_TOMORROW_LIST_SEND_HOUR,
  };
}

export async function updatePlatformTomorrowListSettings(
  input: UpdatePlatformTomorrowListInput,
): Promise<PlatformTomorrowListSettings> {
  const updated = await prisma.platformDailySummaryConfig.updateMany({
    where: { id: CONFIG_ID },
    data: {
      tomorrowListEnabled: input.enabled,
      tomorrowListTemplateName: input.templateName,
      tomorrowListLanguage: input.language,
      tomorrowListSendHour: input.sendHour,
    },
  });
  if (updated.count === 0) {
    throw new PlatformTomorrowListConfigError(
      "Save the Meta account under Settings > Daily Summary first",
    );
  }

  return getPlatformTomorrowListSettings();
}
