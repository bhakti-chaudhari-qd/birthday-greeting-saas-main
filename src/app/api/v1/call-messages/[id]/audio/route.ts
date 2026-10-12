import { NextResponse } from "next/server";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  CallMessageNotFoundError,
  getCallMessageAudio,
} from "@/lib/voice/call-messages";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    const audio = await getCallMessageAudio(auth.organizationId, id);

    return new NextResponse(new Uint8Array(audio.bytes), {
      headers: {
        "Content-Type": audio.contentType,
        "Content-Length": String(audio.byteLength),
        "Content-Disposition": `inline; filename="${audio.filename.replaceAll('"', "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) return authError;
    if (error instanceof CallMessageNotFoundError) {
      return jsonError(error.message, 404);
    }
    console.error("Load call message audio failed", error);
    return jsonError("Failed to load the call recording", 500);
  }
}
