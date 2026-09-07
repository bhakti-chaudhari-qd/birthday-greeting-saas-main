import { NextResponse } from "next/server";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { getBillingOverview } from "@/lib/billing/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAdmin();
    const data = await getBillingOverview(auth.organizationId);
    return NextResponse.json({ data });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Get billing overview failed", error);
    return jsonError("Failed to load billing", 500);
  }
}
