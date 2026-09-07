import { NextResponse } from "next/server";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { getLiveChannelReadiness } from "@/lib/abuse/live-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAdmin();
    const readiness = await getLiveChannelReadiness(
      auth.organizationId,
      auth.userId,
    );

    return NextResponse.json({ data: readiness });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Get live channel readiness failed", error);
    return jsonError("Failed to load live channel readiness", 500);
  }
}
