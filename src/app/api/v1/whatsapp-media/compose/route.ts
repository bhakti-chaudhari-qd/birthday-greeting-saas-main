import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { WHATSAPP_MEDIA_MAX_BASE64_CHARS } from "@/lib/channel-config/whatsapp-types";
import {
  ComposeWhatsAppImageError,
  composeWhatsAppImage,
  decodeBasePhotoBase64,
  decodeOverlayImageBase64,
} from "@/lib/media/compose-whatsapp-image";
import {
  createWhatsAppMediaAssetFromBytes,
  serializeWhatsAppMediaAsset,
  WhatsAppMediaAssetError,
} from "@/lib/media/whatsapp-media-assets";

export const dynamic = "force-dynamic";

const mediaField = z
  .string()
  .trim()
  .min(1)
  .max(WHATSAPP_MEDIA_MAX_BASE64_CHARS);

const composeSchema = z
  .object({
    baseImageBase64: mediaField,
    footerImageBase64: mediaField,
    filename: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const input = composeSchema.parse(await request.json());

    const composed = await composeWhatsAppImage({
      baseImage: decodeBasePhotoBase64(input.baseImageBase64),
      footerImage: decodeOverlayImageBase64(input.footerImageBase64),
    });

    const asset = await createWhatsAppMediaAssetFromBytes(auth.organizationId, {
      bytes: composed.bytes,
      filename: input.filename ?? composed.filename,
      contentType: composed.contentType,
    });

    return NextResponse.json(
      { data: serializeWhatsAppMediaAsset(asset) },
      { status: 201 },
    );
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) return authError;
    if (error instanceof ZodError) {
      return jsonError("Invalid compose input", 400, error.flatten());
    }
    if (
      error instanceof ComposeWhatsAppImageError ||
      error instanceof WhatsAppMediaAssetError
    ) {
      return jsonError(error.message, 400);
    }
    console.error("Compose WhatsApp image failed", error);
    return jsonError("Failed to compose WhatsApp image", 500);
  }
}
