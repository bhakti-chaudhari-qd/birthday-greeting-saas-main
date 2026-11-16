import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { TemplateNotFoundError } from "@/lib/templates/errors";
import {
  WhatsAppApprovalError,
  getWhatsAppApproval,
  refreshWhatsAppApproval,
  submitWhatsAppApprovalSchema,
  submitWhatsAppTemplateForApproval,
} from "@/lib/templates/whatsapp-approval";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorResponse(error: unknown, fallback: string) {
  const authError = sessionAuthErrorResponse(error);
  if (authError) {
    return authError;
  }
  if (error instanceof TemplateNotFoundError) {
    return jsonError(error.message, 404);
  }
  if (error instanceof WhatsAppApprovalError) {
    return jsonError(error.message, 400, { code: error.code });
  }
  if (error instanceof ZodError) {
    return jsonError("Choose a category", 400, error.flatten());
  }
  console.error(fallback, error);
  return jsonError(fallback, 500);
}

/**
 * The template's Meta approval state. `?refresh=1` asks Meta for the
 * latest status first (needs the client's own Meta connection).
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    const refresh = new URL(request.url).searchParams.get("refresh") === "1";

    return NextResponse.json({
      data: refresh
        ? await refreshWhatsAppApproval(auth.organizationId, id)
        : await getWhatsAppApproval(auth.organizationId, id),
    });
  } catch (error) {
    return errorResponse(error, "Failed to check the template status");
  }
}

/** Owner-only: submit the saved template to Meta for approval. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    const { category } = submitWhatsAppApprovalSchema.parse(await request.json());

    return NextResponse.json({
      data: await submitWhatsAppTemplateForApproval(auth.organizationId, id, category),
    });
  } catch (error) {
    return errorResponse(error, "Failed to submit the template");
  }
}
