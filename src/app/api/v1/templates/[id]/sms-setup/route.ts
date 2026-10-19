import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  TemplateNotFoundError,
  TemplateValidationError,
} from "@/lib/templates/errors";
import {
  getTemplateSmsSetup,
  updateTemplateSmsSetup,
} from "@/lib/templates/sms-setup";
import { updateTemplateSmsSetupSchema } from "@/lib/validation/template-sms-setup";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    const setup = await getTemplateSmsSetup(auth.organizationId, id);

    return NextResponse.json({ data: setup });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof TemplateNotFoundError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof TemplateValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Get template SMS setup failed", error);
    return jsonError("Failed to get template SMS setup", 500);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const input = updateTemplateSmsSetupSchema.parse(body);
    const setup = await updateTemplateSmsSetup(
      auth.organizationId,
      id,
      input,
    );

    return NextResponse.json({ data: setup });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid SMS setup input", 400, error.flatten());
    }

    if (error instanceof TemplateValidationError) {
      return jsonError(error.message, 400);
    }

    if (error instanceof TemplateNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Update template SMS setup failed", error);
    return jsonError("Failed to update template SMS setup", 500);
  }
}
