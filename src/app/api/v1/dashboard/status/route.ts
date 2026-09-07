import { NextResponse } from "next/server";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { getDashboardHomeStatus } from "@/lib/dashboard/home-summary";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAuth();
    const status = await getDashboardHomeStatus(auth.organizationId);

    return NextResponse.json({ data: status });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Get dashboard status failed", error);
    return jsonError("Failed to load dashboard status", 500);
  }
}