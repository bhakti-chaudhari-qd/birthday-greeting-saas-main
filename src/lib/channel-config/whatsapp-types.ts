import { z } from "zod";

/** Max decoded media size for Custom HTTP `file` (JPEG or short video). */
export const WHATSAPP_MEDIA_MAX_BYTES = 50_000_000;

/** Base64 payload length budget (~4/3 of max bytes + padding). */
export const WHATSAPP_MEDIA_MAX_BASE64_CHARS = 68_000_000;

export const WHATSAPP_MEDIA_CONTENT_TYPES = [
  "image/jpeg",
  "video/mp4",
  "video/webm",
] as const;

export type WhatsAppMediaContentType =
  (typeof WHATSAPP_MEDIA_CONTENT_TYPES)[number];

export const whatsappMediaContentTypeSchema = z.enum(
  WHATSAPP_MEDIA_CONTENT_TYPES,
);

export const whatsappHttpCredentialsSchema = z
  .object({
    /** CustomAPI-style auth. Optional so an apiKey-only gateway is also valid. */
    username: z.string().trim().min(1).optional(),
    /** Optional - some CustomAPI deployments authenticate with username only. */
    password: z.string().default(""),
    /** Single API-key auth (e.g. the `apikey_wp` gateway field) - an alternative to username/password. */
    apiKey: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.username?.trim() && !value.apiKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either a username or an API key is required",
        path: ["username"],
      });
    }
  });

export const whatsappHttpSettingsSchema = z
  .object({
    /** Required per tenant - no product default vendor URL. */
    baseUrl: z.string().trim().url(),
    /** Required per tenant - e.g. /api/CustomAPI/CustomAPI_SendWhatsApp */
    sendPath: z
      .string()
      .trim()
      .min(1)
      .regex(/^\//, "Send path must start with /"),
    requestTimeoutMs: z.number().int().positive().optional(),
    /**
     * Testing adapters often use IP HTTPS / self-signed certs.
     * Default true when omitted so Custom HTTP behaves like Postman.
     */
    tlsInsecure: z.boolean().optional(),
    /** Optional tenant media (base64, no data: prefix) for Custom HTTP `file`. */
    mediaBase64: z
      .string()
      .trim()
      .min(1)
      .max(WHATSAPP_MEDIA_MAX_BASE64_CHARS)
      .optional(),
    mediaFilename: z.string().trim().min(1).max(120).optional(),
    mediaContentType: whatsappMediaContentTypeSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasMedia = Boolean(value.mediaBase64?.trim());
    if (hasMedia && !value.mediaFilename?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "mediaFilename is required when mediaBase64 is set",
        path: ["mediaFilename"],
      });
    }
  });

/** Media persisted for local TEST sends without live provider settings. */
export const whatsappTestSettingsSchema = z
  .object({
    mediaBase64: z
      .string()
      .trim()
      .min(1)
      .max(WHATSAPP_MEDIA_MAX_BASE64_CHARS)
      .optional(),
    mediaFilename: z.string().trim().min(1).max(120).optional(),
    mediaContentType: whatsappMediaContentTypeSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mediaBase64?.trim() && !value.mediaFilename?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "mediaFilename is required when mediaBase64 is set",
        path: ["mediaFilename"],
      });
    }
  });

export type WhatsAppHttpCredentials = z.infer<
  typeof whatsappHttpCredentialsSchema
>;
export type WhatsAppHttpSettings = z.infer<typeof whatsappHttpSettingsSchema>;

export type ResolvedWhatsAppHttpProviderConfig = {
  baseUrl: string;
  sendPath: string;
  username?: string;
  password: string;
  /** Single API-key auth (e.g. `apikey_wp`) - takes priority over username/password when set. */
  apiKey?: string;
  requestTimeoutMs: number;
  /** When true (default), skip TLS cert verification for Custom HTTP testing. */
  tlsInsecure: boolean;
  mediaBytes?: Buffer;
  mediaFilename?: string;
  mediaContentType?: string;
};

export function isJpegBuffer(bytes: Buffer): boolean {
  return (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

/** EBML header used by WebM / Matroska. */
export function isWebmBuffer(bytes: Buffer): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  );
}

/** ISO BMFF `ftyp` box (MP4 / many M4V files). */
export function isMp4Buffer(bytes: Buffer): boolean {
  if (bytes.length < 12) {
    return false;
  }
  return (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  );
}

export function detectWhatsAppMediaContentType(
  bytes: Buffer,
): WhatsAppMediaContentType | null {
  if (isJpegBuffer(bytes)) {
    return "image/jpeg";
  }
  if (isWebmBuffer(bytes)) {
    return "video/webm";
  }
  if (isMp4Buffer(bytes)) {
    return "video/mp4";
  }
  return null;
}

export function stripWhatsAppMediaDataUrlPrefix(mediaBase64: string): string {
  return mediaBase64
    .trim()
    .replace(/^data:image\/jpeg;base64,/i, "")
    .replace(/^data:video\/mp4;base64,/i, "")
    .replace(/^data:video\/webm;base64,/i, "");
}

export function defaultFilenameForMediaType(
  contentType: WhatsAppMediaContentType,
): string {
  if (contentType === "video/mp4") {
    return "greeting-video.mp4";
  }
  if (contentType === "video/webm") {
    return "greeting-video.webm";
  }
  return "whatsapp-media.jpg";
}

export type DecodedWhatsAppMedia = {
  bytes: Buffer;
  contentType: WhatsAppMediaContentType;
};

export function decodeWhatsAppMediaBase64(
  mediaBase64: string,
): DecodedWhatsAppMedia {
  const normalized = stripWhatsAppMediaDataUrlPrefix(mediaBase64);
  const bytes = Buffer.from(normalized, "base64");

  if (bytes.length === 0) {
    throw new Error("WhatsApp media is empty");
  }

  if (bytes.length > WHATSAPP_MEDIA_MAX_BYTES) {
    throw new Error(
      `WhatsApp media must be at most ${WHATSAPP_MEDIA_MAX_BYTES} bytes`,
    );
  }

  const contentType = detectWhatsAppMediaContentType(bytes);
  if (!contentType) {
    throw new Error(
      "WhatsApp media must be a JPEG image or MP4/WebM video",
    );
  }

  return { bytes, contentType };
}
