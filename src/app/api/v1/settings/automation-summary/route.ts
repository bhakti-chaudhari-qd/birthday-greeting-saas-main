import { NextResponse } from "next/server";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { getAutomationSummary } from "@/lib/automation/summary";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAuth();
    const summary = await getAutomationSummary(auth.organizationId);

    return NextResponse.json({ data: summary });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Get automation summary failed", error);
    return jsonError("Failed to load automation summary", 500);
  }
}
