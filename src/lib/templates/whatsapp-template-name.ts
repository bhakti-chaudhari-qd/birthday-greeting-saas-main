import type { WhatsAppMediaContentType } from "@/lib/channel-config/whatsapp-types";

export type WhatsAppMediaKind = "IMAGE" | "VIDEO";

export function whatsappMediaKindFromContentType(
  contentType: string | null | undefined,
): WhatsAppMediaKind | null {
  if (!contentType) {
    return null;
  }
  if (contentType === "image/jpeg" || contentType.startsWith("image/")) {
    return "IMAGE";
  }
  if (
    contentType === "video/mp4" ||
    contentType === "video/webm" ||
    contentType.startsWith("video/")
  ) {
    return "VIDEO";
  }
  return null;
}

/** Prefer content-type; fall back to system names like "Birthday Image message". */
export function resolveWhatsAppMediaKind(input: {
  contentType?: string | null;
  name?: string | null;
}): WhatsAppMediaKind | null {
  const fromType = whatsappMediaKindFromContentType(input.contentType);
  if (fromType) {
    return fromType;
  }
  const name = input.name?.trim() ?? "";
  if (/\bimage\s+message\b/i.test(name)) {
    return "IMAGE";
  }
  if (/\bvideo\s+message\b/i.test(name)) {
    return "VIDEO";
  }
  return null;
}

/**
 * System name for WhatsApp templates: text-only greeting, or Image/Video message.
 */
export function templateNameForOccasionMedia(
  occasionName: string,
  contentType?: WhatsAppMediaContentType | string | null,
): string {
  const occasion = occasionName.trim() || "Greeting";
  const kind = whatsappMediaKindFromContentType(contentType);
  if (kind === "IMAGE") {
    return `${occasion} Image message`;
  }
  if (kind === "VIDEO") {
    return `${occasion} Video message`;
  }
  return `${occasion} greeting`;
}
