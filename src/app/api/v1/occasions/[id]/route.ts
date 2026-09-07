import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  OccasionConflictError,
  OccasionDeleteBlockedError,
  OccasionNotFoundError,
  OccasionValidationError,
  deleteOccasion,
  updateOccasion,
} from "@/lib/occasions/service";
import { updateOccasionSchema } from "@/lib/occasions/validation";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const input = updateOccasionSchema.parse(body);
    const data = await updateOccasion(auth.organizationId, id, input.name);
    return NextResponse.json({ data });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid occasion input", 400, error.flatten());
    }

    if (error instanceof OccasionValidationError) {
      return jsonError(error.message, 400);
    }

    if (error instanceof OccasionNotFoundError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof OccasionConflictError) {
      return jsonError(error.message, 409);
    }

    console.error("Update occasion failed", error);
    return jsonError("Failed to update occasion", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    await deleteOccasion(auth.organizationId, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof OccasionNotFoundError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof OccasionDeleteBlockedError) {
      return jsonError(error.message, 409, { reasons: error.reasons });
    }

    if (error instanceof OccasionValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Delete occasion failed", error);
    return jsonError("Failed to delete occasion", 500);
  }
}
