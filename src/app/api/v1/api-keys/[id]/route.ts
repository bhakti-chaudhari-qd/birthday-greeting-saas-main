import { NextResponse } from "next/server";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { ApiKeyNotFoundError, revokeApiKey } from "@/lib/api-keys/service";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Revokes the key. The row is kept so the Owner still sees its history. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    await revokeApiKey(auth.organizationId, id);

    return NextResponse.json({ data: { id, revoked: true } });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ApiKeyNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Revoke API key failed", error);
    return jsonError("Failed to revoke API key", 500);
  }
}
