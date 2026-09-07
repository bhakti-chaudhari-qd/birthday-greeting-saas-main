import { UserRole } from "@prisma/client";
import type { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import {
  AuthorizationError,
} from "@/lib/auth/permissions";
import { getAuthContext } from "@/lib/auth/context";
import type { AuthContext } from "@/lib/auth/types";

export async function requireSessionAuth(): Promise<AuthContext> {
  const auth = await getAuthContext();

  if (!auth) {
    throw new Error("UNAUTHORIZED");
  }

  return auth;
}

/** Organization Owner only (DB role ADMIN - not Platform Admin). */
export async function requireSessionAdmin(): Promise<AuthContext> {
  const auth = await requireSessionAuth();

  if (auth.role !== UserRole.ADMIN) {
    throw new AuthorizationError();
  }

  return auth;
}

/** Maps session auth failures to 401/403 responses; otherwise null. */
export function sessionAuthErrorResponse(
  error: unknown,
): NextResponse | null {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return jsonError("Authentication required", 401);
  }

  if (error instanceof AuthorizationError) {
    return jsonError("Forbidden", 403);
  }

  return null;
}
