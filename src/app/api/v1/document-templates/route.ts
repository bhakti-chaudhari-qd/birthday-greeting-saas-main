import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { DocumentTemplateValidationError } from "@/lib/document-templates/errors";
import {
  createDocumentTemplate,
  listDocumentTemplates,
  serializeDocumentTemplate,
} from "@/lib/document-templates/service";
import {
  createDocumentTemplateMetadataSchema,
  listDocumentTemplatesQuerySchema,
} from "@/lib/validation/document-template";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const formData = await request.formData();

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonError("A PDF file is required", 400);
    }

    const nameRaw = formData.get("name");
    const occasionIdRaw = formData.get("occasionId");
    const input = createDocumentTemplateMetadataSchema.parse({
      name: typeof nameRaw === "string" ? nameRaw : undefined,
      occasionId:
        typeof occasionIdRaw === "string" && occasionIdRaw
          ? occasionIdRaw
          : undefined,
    });

    const bytes = Buffer.from(await file.arrayBuffer());
    const template = await createDocumentTemplate(
      auth.organizationId,
      auth.userId,
      {
        ...input,
        file: { bytes, filename: file.name, contentType: file.type },
      },
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

    console.error("Create document template failed", error);
    return jsonError("Failed to create document template", 500);
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireSessionAuth();
    const { searchParams } = new URL(request.url);
    const query = listDocumentTemplatesQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      occasionId: searchParams.get("occasionId") ?? undefined,
      isActive: searchParams.get("isActive") ?? undefined,
    });

    const result = await listDocumentTemplates(auth.organizationId, query);

    return NextResponse.json(result);
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid query parameters", 400, error.flatten());
    }

    console.error("List document templates failed", error);
    return jsonError("Failed to list document templates", 500);
  }
}
