import { NextResponse } from "next/server";

import {
  requireApiAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/api-auth";
import { jsonError } from "@/lib/api/response";
import { getStuckPendingSummary } from "@/lib/queue/stuck";

export const dynamic = "force-dynamic";

export async function GET(request?: Request) {
  try {
    const auth = await requireApiAuth(request);
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
