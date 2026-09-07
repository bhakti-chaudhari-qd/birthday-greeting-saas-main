import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { ZodError } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { generatedDocumentErrorResponse } from "@/lib/generated-documents/api-errors";
import {
  createGeneratedDocument,
  listGeneratedDocuments,
} from "@/lib/generated-documents/service";
import { serializeGeneratedDocument } from "@/lib/generated-documents/serialize";
import {
  createGeneratedDocumentSchema,
  listGeneratedDocumentsQuerySchema,
} from "@/lib/validation/generated-document";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireSessionAuth();
    const { searchParams } = new URL(request.url);
    const query = listGeneratedDocumentsQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const result = await listGeneratedDocuments(auth.organizationId, query);

    return NextResponse.json({
      ...result,
      meta: {
        ...result.meta,
        canManage: auth.role === UserRole.ADMIN,
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid query parameters", 400, error.flatten());
    }

    console.error("List generated documents failed", error);
    return jsonError("Failed to list generated documents", 500);
  }
}

/** Generates a PDF (Phase 4, unchanged) and persists it (Phase 5). */
export async function POST(request: Request) {
  try {
    const auth = await requireSessionAuth();
    const body = await request.json().catch(() => ({}));
    const input = createGeneratedDocumentSchema.parse(body);

    const document = await createGeneratedDocument(
      auth.organizationId,
      auth.userId,
      input.templateId,
      input.data,
    );

    return NextResponse.json(
      { data: serializeGeneratedDocument(document) },
      { status: 201 },
    );
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid generation input", 400, error.flatten());
    }

    const mapped = generatedDocumentErrorResponse(error);
    if (mapped) {
      return mapped;
    }

    console.error("Generate and store document failed", error);
    return jsonError("Failed to generate document", 500);
  }
}
