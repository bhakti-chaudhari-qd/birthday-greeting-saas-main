import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { whatsappMediaContentTypeSchema } from "@/lib/channel-config/whatsapp-types";
import {
  createWhatsAppMediaAsset,
  serializeWhatsAppMediaAsset,
  WhatsAppMediaAssetError,
} from "@/lib/media/whatsapp-media-assets";

export const dynamic = "force-dynamic";

const uploadSchema = z
  .object({
    mediaBase64: z.string().min(1),
    filename: z.string().trim().min(1).max(120).optional(),
    contentType: whatsappMediaContentTypeSchema.optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const input = uploadSchema.parse(await request.json());
    const asset = await createWhatsAppMediaAsset(auth.organizationId, input);
    return NextResponse.json(
      { data: serializeWhatsAppMediaAsset(asset) },
      { status: 201 },
    );
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) return authError;
    if (error instanceof ZodError) {
      return jsonError("Invalid WhatsApp media input", 400, error.flatten());
    }
    if (error instanceof WhatsAppMediaAssetError) {
      return jsonError(error.message, 400);
    }
    console.error("Upload WhatsApp media failed", error);
    return jsonError("Failed to upload WhatsApp media", 500);
  }
}
