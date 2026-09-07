import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  DocumentTemplateNotFoundError,
  DocumentTemplateValidationError,
} from "@/lib/document-templates/errors";
import {
  deleteDocumentTemplate,
  getDocumentTemplate,
  serializeDocumentTemplate,
  updateDocumentTemplate,
} from "@/lib/document-templates/service";
import { updateDocumentTemplateSchema } from "@/lib/validation/document-template";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    const template = await getDocumentTemplate(auth.organizationId, id);

    return NextResponse.json({ data: serializeDocumentTemplate(template) });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof DocumentTemplateNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Get document template failed", error);
    return jsonError("Failed to get document template", 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const input = updateDocumentTemplateSchema.parse(body);
    const template = await updateDocumentTemplate(
      auth.organizationId,
      id,
      input,
    );

    return NextResponse.json({ data: serializeDocumentTemplate(template) });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError(
        "Invalid document template input",
        400,
        error.flatten(),
      );
    }

    if (error instanceof DocumentTemplateValidationError) {
      return jsonError(error.message, 400);
    }

    if (error instanceof DocumentTemplateNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Update document template failed", error);
    return jsonError("Failed to update document template", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    await deleteDocumentTemplate(auth.organizationId, id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof DocumentTemplateNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Delete document template failed", error);
    return jsonError("Failed to delete document template", 500);
  }
}
