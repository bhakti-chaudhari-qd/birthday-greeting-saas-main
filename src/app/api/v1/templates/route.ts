import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { TemplateValidationError } from "@/lib/templates/errors";
import {
  createTemplate,
  listTemplates,
  serializeTemplate,
} from "@/lib/templates/service";
import {
  createTemplateSchema,
  listTemplatesQuerySchema,
} from "@/lib/validation/template";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = createTemplateSchema.parse(body);
    const template = await createTemplate(auth.organizationId, input);

    return NextResponse.json(
      { data: serializeTemplate(template) },
      { status: 201 },
    );
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid template input", 400, error.flatten());
    }

    if (error instanceof TemplateValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Create template failed", error);
    return jsonError("Failed to create template", 500);
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireSessionAuth();
    const { searchParams } = new URL(request.url);
    const query = listTemplatesQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      occasionId: searchParams.get("occasionId") ?? undefined,
      channel: searchParams.get("channel") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      isActive: searchParams.get("isActive") ?? undefined,
    });

    const result = await listTemplates(auth.organizationId, query);

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

    console.error("List templates failed", error);
    return jsonError("Failed to list templates", 500);
  }
}
