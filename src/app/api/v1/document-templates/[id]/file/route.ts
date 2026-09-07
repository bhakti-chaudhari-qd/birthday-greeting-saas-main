import { NextResponse } from "next/server";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { DocumentTemplateNotFoundError } from "@/lib/document-templates/errors";
import { getDocumentTemplateFile } from "@/lib/document-templates/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    const file = await getDocumentTemplateFile(auth.organizationId, id);

    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.byteLength),
        "Content-Disposition": `inline; filename="${file.fileName.replaceAll('"', "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof DocumentTemplateNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Serve document template file failed", error);
    return jsonError("Failed to load document template file", 500);
  }
}
