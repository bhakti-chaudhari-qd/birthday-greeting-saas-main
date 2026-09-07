import { z } from "zod";

import {
  WHATSAPP_MEDIA_MAX_BASE64_CHARS,
  whatsappMediaContentTypeSchema,
} from "@/lib/channel-config/whatsapp-types";

export const suggestMessageToneSchema = z.enum(["warm", "short", "formal"]);

export const suggestMessageSchema = z
  .object({
    occasionName: z.string().trim().min(1).max(50),
    channel: z.enum(["SMS", "WHATSAPP"]),
    tone: suggestMessageToneSchema.optional().default("warm"),
    existingBody: z.string().trim().max(2000).optional().nullable(),
    /** Return 1 draft by default. Higher counts remain supported for API callers. */
    variantCount: z.coerce.number().int().min(1).max(3).optional().default(1),
  })
  .strict();

export const rewriteMessageActionSchema = z.enum([
  "shorter",
  "formal",
  "warmer",
]);

export const rewriteMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
    channel: z.enum(["SMS", "WHATSAPP"]),
    occasionName: z.string().trim().min(1).max(50).optional(),
    action: rewriteMessageActionSchema,
  })
  .strict();

/** Apply a generated/uploaded greeting video (or JPEG) to WhatsApp Custom HTTP media. */
export const applyWhatsAppMediaSchema = z
  .object({
    mediaBase64: z
      .string()
      .trim()
      .min(1)
      .max(WHATSAPP_MEDIA_MAX_BASE64_CHARS),
    mediaFilename: z.string().trim().min(1).max(120),
    mediaContentType: whatsappMediaContentTypeSchema.optional(),
    occasionName: z.string().trim().min(1).max(50).optional(),
  })
  .strict();

export type SuggestMessageInput = z.infer<typeof suggestMessageSchema>;
export type SuggestMessageTone = z.infer<typeof suggestMessageToneSchema>;
export type RewriteMessageInput = z.infer<typeof rewriteMessageSchema>;
export type RewriteMessageAction = z.infer<typeof rewriteMessageActionSchema>;
export type ApplyWhatsAppMediaInput = z.infer<typeof applyWhatsAppMediaSchema>;
