import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { TemplateValidationError } from "@/lib/templates/errors";
import {
  createTemplateFromStarter,
  serializeTemplate,
} from "@/lib/templates/service";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ starterId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { starterId } = await context.params;
    const { template, created } = await createTemplateFromStarter(
      auth.organizationId,
      starterId,
    );

    return NextResponse.json(
      { data: serializeTemplate(template), meta: { created } },
      { status: created ? 201 : 200 },
    );
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid starter template input", 400, error.flatten());
    }

    if (error instanceof TemplateValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Create template from starter failed", error);
    return jsonError("Failed to create template from starter", 500);
  }
}
