import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  ContactCategoryConflictError,
  ContactCategoryValidationError,
  createContactCategory,
  listContactCategories,
} from "@/lib/contacts/categories";
import { createContactCategorySchema } from "@/lib/validation/contact";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAuth();
    const data = await listContactCategories(auth.organizationId);
    return NextResponse.json({ data });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("List contact categories failed", error);
    return jsonError("Failed to list categories", 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAuth();
    const body = await request.json();
    const input = createContactCategorySchema.parse(body);
    const data = await createContactCategory(auth.organizationId, input.name);
    return NextResponse.json({ data }, { status: 201 });
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

    if (error instanceof ContactCategoryConflictError) {
      return jsonError(error.message, 409);
    }

    console.error("Create contact category failed", error);
    return jsonError("Failed to create category", 500);
  }
}
