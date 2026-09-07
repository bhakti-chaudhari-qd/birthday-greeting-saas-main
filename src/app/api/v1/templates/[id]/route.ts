import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  TemplateInUseError,
  TemplateNotFoundError,
  TemplateValidationError,
} from "@/lib/templates/errors";
import {
  deleteTemplate,
  getTemplate,
  serializeTemplate,
  updateTemplate,
} from "@/lib/templates/service";
import { updateTemplateSchema } from "@/lib/validation/template";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    const template = await getTemplate(auth.organizationId, id);

    return NextResponse.json({ data: serializeTemplate(template) });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof TemplateNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Get template failed", error);
    return jsonError("Failed to get template", 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const input = updateTemplateSchema.parse(body);
    const template = await updateTemplate(auth.organizationId, id, input);

    return NextResponse.json({ data: serializeTemplate(template) });
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

    if (error instanceof TemplateNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Update template failed", error);
    return jsonError("Failed to update template", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    await deleteTemplate(auth.organizationId, id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof TemplateInUseError) {
      return jsonError(error.message, 409);
    }

    if (error instanceof TemplateNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Delete template failed", error);
    return jsonError("Failed to delete template", 500);
  }
}
