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
import { getSmsChannelBalance } from "@/lib/channel-config/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAdmin();
    const result = await getSmsChannelBalance(auth.organizationId);

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

    console.error("Get SMS channel balance failed", error);
    return jsonError("Failed to load SMS wallet balance", 500);
  }
}
