import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { ChannelConfigValidationError } from "@/lib/channel-config/errors";
import {
  getEmailChannelConfig,
  upsertEmailChannelConfig,
} from "@/lib/channel-config/email-service";
import { emailChannelConfigWriteSchema } from "@/lib/validation/email-channel-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAdmin();
    const config = await getEmailChannelConfig(auth.organizationId);

    return NextResponse.json({ data: config });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Get Email channel config failed", error);
    return jsonError("Failed to load Email channel configuration", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = emailChannelConfigWriteSchema.parse(body);
    const config = await upsertEmailChannelConfig(auth.organizationId, input);

    return NextResponse.json({ data: config });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError(
        "Invalid Email channel configuration",
        400,
        error.flatten(),
      );
    }

    if (error instanceof ChannelConfigValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Update Email channel config failed", error);
    return jsonError("Failed to save Email channel configuration", 500);
  }
}
