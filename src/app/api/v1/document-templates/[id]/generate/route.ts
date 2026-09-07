import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  DocumentTemplateNotFoundError,
  DocumentTemplateValidationError,
} from "@/lib/document-templates/errors";
import { generateDocumentPdf } from "@/lib/document-templates/generate.service";
import { generateDocumentTemplateSchema } from "@/lib/validation/document-template-generate";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const input = generateDocumentTemplateSchema.parse(body);

    const { bytes, fileName } = await generateDocumentPdf(
      auth.organizationId,
      id,
      input.data,
    );

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `attachment; filename="${fileName.replaceAll('"', "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid generation input", 400, error.flatten());
    }

    if (error instanceof DocumentTemplateNotFoundError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof DocumentTemplateValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Generate document PDF failed", error);
    return jsonError("Failed to generate document PDF", 500);
  }
}
