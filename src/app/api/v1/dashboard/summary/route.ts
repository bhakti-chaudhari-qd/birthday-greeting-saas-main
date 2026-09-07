import { NextResponse } from "next/server";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { getDashboardHomeSummary } from "@/lib/dashboard/home-summary";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAuth();
    const summary = await getDashboardHomeSummary(
      auth.organizationId,
      auth.role,
    );

    return NextResponse.json({ data: summary });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Get dashboard summary failed", error);
    return jsonError("Failed to load dashboard summary", 500);
  }
}
