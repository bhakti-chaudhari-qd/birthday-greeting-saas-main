import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  ContactCategoryConflictError,
  ContactCategoryNotFoundError,
  ContactCategoryValidationError,
  deleteContactCategory,
  updateContactCategory,
} from "@/lib/contacts/categories";
import { updateContactCategorySchema } from "@/lib/validation/contact";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    const body = await request.json();
    const input = updateContactCategorySchema.parse(body);
    const data = await updateContactCategory(
      auth.organizationId,
      id,
      input.name,
    );
    return NextResponse.json({ data });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid category input", 400, error.flatten());
    }

    if (error instanceof ContactCategoryValidationError) {
      return jsonError(error.message, 400);
    }

    if (error instanceof ContactCategoryNotFoundError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof ContactCategoryConflictError) {
      return jsonError(error.message, 409);
    }

    console.error("Update contact category failed", error);
    return jsonError("Failed to update category", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    await deleteContactCategory(auth.organizationId, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ContactCategoryNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Delete contact category failed", error);
    return jsonError("Failed to delete category", 500);
  }
}
