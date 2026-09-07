import { createCanvas, loadImage } from "@napi-rs/canvas";

import { WHATSAPP_MEDIA_MAX_BYTES } from "@/lib/channel-config/whatsapp-types";
import {
  findFooterContentBounds,
  overlayFooterLayout,
} from "@/lib/media/overlay-footer-layout";

export class ComposeWhatsAppImageError extends Error {}

export type ComposeWhatsAppImageInput = {
  /** Main photo (JPEG bytes). */
  baseImage: Buffer;
  /** Footer layer (JPEG/PNG) drawn on top of the photo at the bottom. */
  footerImage: Buffer;
};

const MAX_EDGE = 1920;

export { overlayFooterLayout } from "@/lib/media/overlay-footer-layout";

function isJpeg(bytes: Buffer) {
  return (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

function isPng(bytes: Buffer) {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function stripDataUrl(mediaBase64: string): string {
  return mediaBase64.trim().replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
}

export function decodeOverlayImageBase64(mediaBase64: string): Buffer {
  const bytes = Buffer.from(stripDataUrl(mediaBase64), "base64");
  if (bytes.length === 0) {
    throw new ComposeWhatsAppImageError("Overlay image is empty");
  }
  if (bytes.length > WHATSAPP_MEDIA_MAX_BYTES) {
    throw new ComposeWhatsAppImageError(
      `Overlay image must be at most ${WHATSAPP_MEDIA_MAX_BYTES} bytes`,
    );
  }
  if (!isJpeg(bytes) && !isPng(bytes)) {
    throw new ComposeWhatsAppImageError("Footer images must be JPEG or PNG");
  }
  return bytes;
}

export function decodeBasePhotoBase64(mediaBase64: string): Buffer {
  const bytes = Buffer.from(stripDataUrl(mediaBase64), "base64");
  if (bytes.length === 0) {
    throw new ComposeWhatsAppImageError("Photo is empty");
  }
  if (bytes.length > WHATSAPP_MEDIA_MAX_BYTES) {
    throw new ComposeWhatsAppImageError(
      `Photo must be at most ${WHATSAPP_MEDIA_MAX_BYTES} bytes`,
    );
  }
  if (!isJpeg(bytes)) {
    throw new ComposeWhatsAppImageError("WhatsApp photo must be a JPEG image");
  }
  return bytes;
}

/**
 * Remove transparent / near-black padding so full-canvas footer templates
 * only contribute their real artwork height when overlaid.
 */
function trimFooterArtwork(
  source: Awaited<ReturnType<typeof loadImage>>,
): {
  image: ReturnType<typeof createCanvas> | Awaited<ReturnType<typeof loadImage>>;
  width: number;
  height: number;
} {
  const probe = createCanvas(source.width, source.height);
  const probeCtx = probe.getContext("2d");
  if (!probeCtx) {
    throw new ComposeWhatsAppImageError("Could not inspect footer image");
  }
  probeCtx.drawImage(source, 0, 0);
  const imageData = probeCtx.getImageData(0, 0, source.width, source.height);
  const bounds = findFooterContentBounds(
    imageData.data,
    source.width,
    source.height,
  );

  if (!bounds) {
    return { image: source, width: source.width, height: source.height };
  }

  // Already tight enough - skip an extra copy.
  if (
    bounds.left === 0 &&
    bounds.top === 0 &&
    bounds.width === source.width &&
    bounds.height === source.height
  ) {
    return { image: source, width: source.width, height: source.height };
  }

  const trimmed = createCanvas(bounds.width, bounds.height);
  const trimmedCtx = trimmed.getContext("2d");
  if (!trimmedCtx) {
    throw new ComposeWhatsAppImageError("Could not trim footer image");
  }
  trimmedCtx.drawImage(
    source,
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );
  // createCanvas() and loadImage() share drawImage-compatible bitmaps at runtime.
  return {
    image: trimmed as unknown as typeof source,
    width: bounds.width,
    height: bounds.height,
  };
}

/**
 * Compose a WhatsApp JPEG: base photo with footer overlaid at the bottom.
 * Looks like a single poster image for any base + footer pair.
 */
export async function composeWhatsAppImage(
  input: ComposeWhatsAppImageInput,
): Promise<{ bytes: Buffer; filename: string; contentType: "image/jpeg" }> {
  if (!input.footerImage?.length) {
    throw new ComposeWhatsAppImageError("Add a footer image to compose");
  }

  const base = await loadImage(input.baseImage);
  const footerSource = await loadImage(input.footerImage);
  const footer = trimFooterArtwork(footerSource);
  const layout = overlayFooterLayout(
    base.width,
    base.height,
    footer.width,
    footer.height,
    MAX_EDGE,
  );

  const canvas = createCanvas(layout.width, layout.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new ComposeWhatsAppImageError("Could not create image canvas");
  }

  ctx.drawImage(base, 0, 0, layout.width, layout.height);
  ctx.drawImage(
    footer.image as Parameters<typeof ctx.drawImage>[0],
    layout.footerX,
    layout.footerY,
    layout.footerDrawW,
    layout.footerDrawH,
  );

  const bytes = Buffer.from(canvas.toBuffer("image/jpeg", 85));
  if (bytes.length > WHATSAPP_MEDIA_MAX_BYTES) {
    throw new ComposeWhatsAppImageError(
      "Composed image exceeds the WhatsApp media size limit",
    );
  }

  return {
    bytes,
    filename: "whatsapp-composed.jpg",
    contentType: "image/jpeg",
  };
}
