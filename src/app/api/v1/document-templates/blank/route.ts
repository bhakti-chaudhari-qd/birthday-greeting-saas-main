import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { DocumentTemplateValidationError } from "@/lib/document-templates/errors";
import {
  createBlankDocumentTemplate,
  serializeDocumentTemplate,
} from "@/lib/document-templates/service";
import { createBlankDocumentTemplateSchema } from "@/lib/validation/document-template";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const input = createBlankDocumentTemplateSchema.parse(await request.json());

    const template = await createBlankDocumentTemplate(
      auth.organizationId,
      auth.userId,
      input,
    );

    return NextResponse.json(
      { data: serializeDocumentTemplate(template) },
      { status: 201 },
    );
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof SyntaxError) {
      return jsonError("Invalid JSON body", 400);
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

    console.error("Create blank document template failed", error);
    return jsonError("Failed to create document template", 500);
  }
}
