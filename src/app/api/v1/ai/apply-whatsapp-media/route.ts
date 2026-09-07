import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { logAiUsage } from "@/lib/ai/usage-log";
import { ChannelConfigValidationError } from "@/lib/channel-config/errors";
import { updateWhatsAppChannelMedia } from "@/lib/channel-config/whatsapp-service";
import { applyWhatsAppMediaSchema } from "@/lib/validation/ai";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = applyWhatsAppMediaSchema.parse(body);

    const config = await updateWhatsAppChannelMedia(auth.organizationId, {
      mediaBase64: input.mediaBase64,
      mediaFilename: input.mediaFilename,
      mediaContentType: input.mediaContentType,
    });

    logAiUsage({
      action: "apply_whatsapp_media",
      organizationId: auth.organizationId,
      provider: "studio",
      occasionName: input.occasionName,
      channel: "WHATSAPP",
      mediaContentType: input.mediaContentType ?? config.mediaContentType,
    });

    return NextResponse.json({
      data: {
        mediaConfigured: config.mediaConfigured,
        mediaFilename: config.mediaFilename,
        mediaContentType: config.mediaContentType,
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid WhatsApp media input", 400, error.flatten());
    }

    if (error instanceof ChannelConfigValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("AI apply-whatsapp-media failed", error);
    return jsonError("Failed to apply WhatsApp media", 500);
  }
}
