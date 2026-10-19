import { NextResponse } from "next/server";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { generatedDocumentErrorResponse } from "@/lib/generated-documents/api-errors";
import { getGeneratedDocumentFile } from "@/lib/generated-documents/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Serves the actual PDF bytes - the only place this feature reads from
 * storage on behalf of a request. Shared by both "View" (inline) and
 * "Download" (attachment) so the auth/org/expiry checks live once.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "1";

    const file = await getGeneratedDocumentFile(auth.organizationId, id);
    const disposition = download ? "attachment" : "inline";

    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(file.bytes.byteLength),
        "Content-Disposition": `${disposition}; filename="${file.fileName.replaceAll('"', "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    const mapped = generatedDocumentErrorResponse(error);
    if (mapped) {
      return mapped;
    }

    console.error("Serve generated document file failed", error);
    return jsonError("Failed to load generated document", 500);
  }
}
