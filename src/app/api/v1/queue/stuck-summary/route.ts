import { NextResponse } from "next/server";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { getStuckPendingSummary } from "@/lib/queue/stuck";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAuth();
    const summary = await getStuckPendingSummary(auth.organizationId);
    return NextResponse.json({ data: summary });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Stuck queue summary failed", error);
    return jsonError("Failed to load queue health", 500);
  }
}
