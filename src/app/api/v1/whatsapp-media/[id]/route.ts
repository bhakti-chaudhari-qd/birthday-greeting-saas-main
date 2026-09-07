import { NextResponse } from "next/server";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  getWhatsAppMediaAsset,
  WhatsAppMediaAssetError,
} from "@/lib/media/whatsapp-media-assets";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    const asset = await getWhatsAppMediaAsset(auth.organizationId, id);

    return new NextResponse(new Uint8Array(asset.bytes), {
      headers: {
        "Content-Type": asset.contentType,
        "Content-Length": String(asset.byteLength),
        "Content-Disposition": `inline; filename="${asset.filename.replaceAll('"', "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) return authError;
    if (error instanceof WhatsAppMediaAssetError) {
      return jsonError(error.message, 404);
    }
    console.error("Preview WhatsApp media failed", error);
    return jsonError("Failed to load WhatsApp media", 500);
  }
}
