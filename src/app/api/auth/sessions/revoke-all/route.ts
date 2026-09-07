import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { destroyAllSessionsAndClearCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Organization Owner: revoke all sessions (including this browser). */
export async function POST() {
  try {
    const auth = await requireSessionAdmin();

    if (auth.role !== UserRole.ADMIN) {
      return jsonError("Forbidden", 403);
    }

    await destroyAllSessionsAndClearCookie(auth.userId);

    return NextResponse.json({
      data: { message: "Signed out of all sessions." },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Revoke all sessions failed", error);
    return jsonError("Could not sign out all sessions", 500);
  }
}
