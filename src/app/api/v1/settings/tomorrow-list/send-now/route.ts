import { NextResponse } from "next/server";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { sendTomorrowListNow } from "@/lib/tomorrow-list/service";

export const dynamic = "force-dynamic";

/**
 * Owner-only: send Tomorrow's List right now to the saved numbers and
 * report what happened (sent per number, nobody tomorrow, or why not).
 */
export async function POST() {
  try {
    const auth = await requireSessionAdmin();

    return NextResponse.json({
      data: await sendTomorrowListNow(auth.organizationId),
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Tomorrow list send-now failed", error);
    return jsonError("Failed to send the list", 500);
  }
}
