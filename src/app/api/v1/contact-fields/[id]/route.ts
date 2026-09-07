import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  ContactFieldConflictError,
  ContactFieldInUseError,
  ContactFieldNotFoundError,
  ContactFieldValidationError,
  deleteContactFieldDefinition,
  updateContactFieldDefinition,
} from "@/lib/contact-fields/service";
import { updateContactFieldDefinitionSchema } from "@/lib/validation/contact-field";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const input = updateContactFieldDefinitionSchema.parse(body);
    const data = await updateContactFieldDefinition(auth.organizationId, id, input);
    return NextResponse.json({ data });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) return authError;

    if (error instanceof ZodError) {
      return jsonError("Invalid contact field input", 400, error.flatten());
    }
    if (error instanceof ContactFieldValidationError) {
      return jsonError(error.message, 400);
    }
    if (error instanceof ContactFieldConflictError) {
      return jsonError(error.message, 409);
    }
    if (error instanceof ContactFieldNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Update contact field failed", error);
    return jsonError("Failed to update contact field", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;
    await deleteContactFieldDefinition(auth.organizationId, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) return authError;

    if (
      error instanceof ContactFieldValidationError ||
      error instanceof ContactFieldInUseError
    ) {
      return jsonError(error.message, 400);
    }
    if (error instanceof ContactFieldNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Delete contact field failed", error);
    return jsonError("Failed to delete contact field", 500);
  }
}
