import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { DocumentTemplateNotFoundError } from "@/lib/document-templates/errors";
import { getLayout, saveLayout } from "@/lib/document-templates/layout.service";
import { saveDocumentTemplateLayoutSchema } from "@/lib/validation/document-template-layout";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    const layoutJson = await getLayout(auth.organizationId, id);

    return NextResponse.json({ data: { layoutJson } });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof DocumentTemplateNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Get document template layout failed", error);
    return jsonError("Failed to get document template layout", 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const input = saveDocumentTemplateLayoutSchema.parse(body);
    const layoutJson = await saveLayout(
      auth.organizationId,
      id,
      input.layoutJson,
    );

    return NextResponse.json({ data: { layoutJson } });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid layout input", 400, error.flatten());
    }

    if (error instanceof DocumentTemplateNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Save document template layout failed", error);
    return jsonError("Failed to save document template layout", 500);
  }
}
