import { ChannelProvider } from "@prisma/client";
import { z } from "zod";

import {
  WHATSAPP_MEDIA_MAX_BASE64_CHARS,
  whatsappMediaContentTypeSchema,
} from "@/lib/channel-config/whatsapp-types";

/** Production channel configuration is live-only - no Test/Simulation provider option. */
const supportedWhatsAppProviders = [ChannelProvider.CUSTOM_HTTP] as const;

export const whatsappChannelConfigWriteSchema = z
  .object({
    provider: z.enum(supportedWhatsAppProviders),
    isActive: z.boolean().default(true),
    username: z.string().trim().min(1).max(200).optional(),
    password: z.string().max(200).optional(),
    /** Single API-key auth (e.g. `apikey_wp`) - an alternative to username/password. */
    apiKey: z.string().trim().min(1).max(200).optional(),
    baseUrl: z.string().trim().url().optional(),
    sendPath: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .regex(/^\//, "Send path must start with /")
      .optional(),
    /** Skip TLS certificate verification (needed for many IP HTTPS test gateways). */
    tlsInsecure: z.boolean().optional(),
    /** New media upload (base64 JPEG or short MP4/WebM). Omit to keep existing. */
    mediaBase64: z
      .string()
      .trim()
      .min(1)
      .max(WHATSAPP_MEDIA_MAX_BASE64_CHARS)
      .optional(),
    mediaFilename: z.string().trim().min(1).max(120).optional(),
    mediaContentType: whatsappMediaContentTypeSchema.optional(),
    /** Drop stored tenant media and fall back to the built-in default JPEG. */
    clearMedia: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.clearMedia && value.mediaBase64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cannot clear media and upload new media in the same request",
        path: ["clearMedia"],
      });
    }

    if (value.mediaBase64 && !value.mediaFilename?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Filename is required when uploading WhatsApp media",
        path: ["mediaFilename"],
      });
    }

    if (value.provider !== ChannelProvider.CUSTOM_HTTP) {
      return;
    }

    // Username/password and API-key are two mutually exclusive auth modes;
    // whichever isn't resent here (including both, on an edit that only
    // touches an unrelated field) falls back to what's already on file -
    // the service layer owns that "is there a usable credential" decision,
    // the same way it already does for password alone.

    if (!value.baseUrl?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Base URL is required for Custom HTTP WhatsApp",
        path: ["baseUrl"],
      });
    }

    if (!value.sendPath?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Send path is required for Custom HTTP WhatsApp",
        path: ["sendPath"],
      });
    }
  });

/**
 * Service-layer contract, intentionally wider than whatsappChannelConfigWriteSchema
 * above: the production PUT /channel-config/whatsapp route validates against
 * that schema (CUSTOM_HTTP only), but upsertWhatsAppChannelConfig is also
 * called directly by automated tests to create ChannelConfig fixtures with
 * provider: TEST, bypassing the production write-schema entirely. Keeping
 * TEST here is what lets that test infrastructure keep typechecking - see
 * the docblock on resolveMessageProvider in messaging/providers/factory.ts.
 */
export type WhatsAppChannelConfigWriteInput = Omit<
  z.input<typeof whatsappChannelConfigWriteSchema>,
  "provider"
> & {
  provider: typeof ChannelProvider.TEST | typeof ChannelProvider.CUSTOM_HTTP;
};
