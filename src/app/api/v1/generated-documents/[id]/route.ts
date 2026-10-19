import { NextResponse } from "next/server";

import {
  requireSessionAdmin,
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { generatedDocumentErrorResponse } from "@/lib/generated-documents/api-errors";
import {
  deleteGeneratedDocument,
  getGeneratedDocument,
} from "@/lib/generated-documents/service";
import { serializeGeneratedDocument } from "@/lib/generated-documents/serialize";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    const document = await getGeneratedDocument(auth.organizationId, id);

    return NextResponse.json({ data: serializeGeneratedDocument(document) });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    const mapped = generatedDocumentErrorResponse(error);
    if (mapped) {
      return mapped;
    }

    console.error("Get generated document failed", error);
    return jsonError("Failed to get generated document", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    await deleteGeneratedDocument(auth.organizationId, id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    const mapped = generatedDocumentErrorResponse(error);
    if (mapped) {
      return mapped;
    }

    console.error("Delete generated document failed", error);
    return jsonError("Failed to delete generated document", 500);
  }
}
