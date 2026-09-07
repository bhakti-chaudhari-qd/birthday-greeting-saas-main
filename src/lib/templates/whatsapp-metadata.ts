import { z } from "zod";

import {
  SUPPORTED_TEMPLATE_VARIABLES,
  type SupportedTemplateVariable,
} from "@/lib/templates/variables";

export const whatsappLanguageSchema = z
  .string()
  .trim()
  .min(2)
  .max(15)
  .regex(
    /^[A-Za-z]{2,3}([_-][A-Za-z0-9]{2,8})?$/,
    "WhatsApp language must be a short language code such as en or en_US",
  );

export type WhatsAppTemplateLanguage = {
  code: string;
  name: string;
};

/**
 * WhatsApp Business Platform's documented template language codes. Static
 * and UI-facing only (drives the searchable language picker) - the format
 * regex above remains the actual server-side source of truth, so a code
 * missing from this list can still be entered/loaded without being rejected.
 */
export const WHATSAPP_TEMPLATE_LANGUAGES: WhatsAppTemplateLanguage[] = [
  { code: "af", name: "Afrikaans" },
  { code: "sq", name: "Albanian" },
  { code: "ar", name: "Arabic" },
  { code: "az", name: "Azerbaijani" },
  { code: "bn", name: "Bengali" },
  { code: "bg", name: "Bulgarian" },
  { code: "ca", name: "Catalan" },
  { code: "zh_CN", name: "Chinese (China)" },
  { code: "zh_HK", name: "Chinese (Hong Kong)" },
  { code: "zh_TW", name: "Chinese (Taiwan)" },
  { code: "hr", name: "Croatian" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "en", name: "English" },
  { code: "en_GB", name: "English (UK)" },
  { code: "en_US", name: "English (US)" },
  { code: "et", name: "Estonian" },
  { code: "fil", name: "Filipino" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "ka", name: "Georgian" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "gu", name: "Gujarati" },
  { code: "ha", name: "Hausa" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hu", name: "Hungarian" },
  { code: "id", name: "Indonesian" },
  { code: "ga", name: "Irish" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "kn", name: "Kannada" },
  { code: "kk", name: "Kazakh" },
  { code: "rw_RW", name: "Kinyarwanda" },
  { code: "ko", name: "Korean" },
  { code: "ky_KG", name: "Kyrgyz (Kyrgyzstan)" },
  { code: "lo", name: "Lao" },
  { code: "lv", name: "Latvian" },
  { code: "lt", name: "Lithuanian" },
  { code: "mk", name: "Macedonian" },
  { code: "ms", name: "Malay" },
  { code: "ml", name: "Malayalam" },
  { code: "mr", name: "Marathi" },
  { code: "nb", name: "Norwegian" },
  { code: "fa", name: "Persian" },
  { code: "pl", name: "Polish" },
  { code: "pt_BR", name: "Portuguese (Brazil)" },
  { code: "pt_PT", name: "Portuguese (Portugal)" },
  { code: "pa", name: "Punjabi" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sr", name: "Serbian" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "es", name: "Spanish" },
  { code: "es_AR", name: "Spanish (Argentina)" },
  { code: "es_ES", name: "Spanish (Spain)" },
  { code: "es_MX", name: "Spanish (Mexico)" },
  { code: "sw", name: "Swahili" },
  { code: "sv", name: "Swedish" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "uz", name: "Uzbek" },
  { code: "vi", name: "Vietnamese" },
  { code: "zu", name: "Zulu" },
];

export function findWhatsAppTemplateLanguage(
  code: string,
): WhatsAppTemplateLanguage | undefined {
  const normalized = code.trim().toLowerCase();
  return WHATSAPP_TEMPLATE_LANGUAGES.find(
    (language) => language.code.toLowerCase() === normalized,
  );
}

export const whatsappTemplateNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(
    /^[A-Za-z0-9_]+$/,
    "WhatsApp provider template name may only contain letters, numbers, and underscores",
  );

export const whatsappProviderTemplateIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "WhatsApp template ID may only contain letters, numbers, underscores, and hyphens",
  );

export const whatsappParameterOrderSchema = z
  .array(z.string().trim().min(1).max(50))
  .max(SUPPORTED_TEMPLATE_VARIABLES.length);

export function normalizeWhatsAppParameterOrder(
  order: string[] | undefined,
  bodyVariables: string[],
): string[] {
  const resolved =
    order && order.length > 0 ? order.map((item) => item.trim()) : bodyVariables;

  const unsupported = resolved.filter(
    (variable) =>
      !SUPPORTED_TEMPLATE_VARIABLES.includes(
        variable as SupportedTemplateVariable,
      ),
  );

  if (unsupported.length > 0) {
    throw new Error(`Unsupported WhatsApp parameters: ${unsupported.join(", ")}`);
  }

  const unique = new Set(resolved);
  if (unique.size !== resolved.length) {
    throw new Error("WhatsApp parameter order must not contain duplicates");
  }

  for (const variable of bodyVariables) {
    if (!resolved.includes(variable)) {
      throw new Error(
        `WhatsApp parameter order must include body variable: ${variable}`,
      );
    }
  }

  for (const variable of resolved) {
    if (!bodyVariables.includes(variable)) {
      throw new Error(
        `WhatsApp parameter order includes unused variable: ${variable}`,
      );
    }
  }

  return resolved;
}

export const whatsappParameterValuesSchema = z.array(
  z.string().trim().min(1).max(1000),
);
