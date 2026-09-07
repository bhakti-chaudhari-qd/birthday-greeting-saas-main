import { NextResponse } from "next/server";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  ChannelConfigNotFoundError,
  ChannelConfigVerificationError,
} from "@/lib/channel-config/errors";
import { verifySmsChannelConfig } from "@/lib/channel-config/service";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const auth = await requireSessionAdmin();
    const result = await verifySmsChannelConfig(auth.organizationId);

    return NextResponse.json({ data: result });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ChannelConfigNotFoundError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof ChannelConfigVerificationError) {
      return jsonError(error.message, 400);
    }

    console.error("Verify SMS channel config failed", error);
    return jsonError("Failed to verify SMS channel configuration", 500);
  }
}
