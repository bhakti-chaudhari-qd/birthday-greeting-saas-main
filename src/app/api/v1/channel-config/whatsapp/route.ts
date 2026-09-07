import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { ChannelConfigValidationError } from "@/lib/channel-config/errors";
import {
  getWhatsAppChannelConfig,
  upsertWhatsAppChannelConfig,
} from "@/lib/channel-config/whatsapp-service";
import { whatsappChannelConfigWriteSchema } from "@/lib/validation/whatsapp-channel-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAdmin();
    const config = await getWhatsAppChannelConfig(auth.organizationId);

    return NextResponse.json({ data: config });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Get WhatsApp channel config failed", error);
    return jsonError("Failed to load WhatsApp channel configuration", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = whatsappChannelConfigWriteSchema.parse(body);
    const config = await upsertWhatsAppChannelConfig(auth.organizationId, input, {
      userId: auth.userId,
    });

    return NextResponse.json({ data: config });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError(
        "Invalid WhatsApp channel configuration",
        400,
        error.flatten(),
      );
    }

    if (error instanceof ChannelConfigValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Update WhatsApp channel config failed", error);
    return jsonError("Failed to save WhatsApp channel configuration", 500);
  }
}
