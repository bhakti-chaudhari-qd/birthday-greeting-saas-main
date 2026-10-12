import { NextResponse } from "next/server";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  CallMessageNotFoundError,
  deleteCallMessage,
} from "@/lib/voice/call-messages";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    await deleteCallMessage(auth.organizationId, id);

    return NextResponse.json({ data: { id } });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) return authError;
    if (error instanceof CallMessageNotFoundError) {
      return jsonError(error.message, 404);
    }
    console.error("Delete call message failed", error);
    return jsonError("Failed to delete the call recording", 500);
  }
}
