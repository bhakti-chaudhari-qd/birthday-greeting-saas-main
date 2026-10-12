import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { ChannelConfigValidationError } from "@/lib/channel-config/errors";
import {
  getVoiceChannelConfig,
  upsertVoiceChannelConfig,
} from "@/lib/channel-config/voice-service";
import { voiceChannelConfigWriteSchema } from "@/lib/validation/voice-channel-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAdmin();
    const config = await getVoiceChannelConfig(auth.organizationId);

    return NextResponse.json({ data: config });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Get Call channel config failed", error);
    return jsonError("Failed to load Call channel configuration", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = voiceChannelConfigWriteSchema.parse(body);
    const config = await upsertVoiceChannelConfig(auth.organizationId, input);

    return NextResponse.json({ data: config });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError(
        error.issues[0]?.message ?? "Invalid Call channel configuration",
        400,
        error.flatten(),
      );
    }

    if (error instanceof ChannelConfigValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Update Call channel config failed", error);
    return jsonError("Failed to save Call channel configuration", 500);
  }
}
