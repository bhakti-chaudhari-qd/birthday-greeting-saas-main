import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  ContactFieldConflictError,
  ContactFieldValidationError,
  createContactFieldDefinition,
  listContactFieldDefinitions,
} from "@/lib/contact-fields/service";
import { createContactFieldDefinitionSchema } from "@/lib/validation/contact-field";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireSessionAuth();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("isActive") === "true";
    const data = await listContactFieldDefinitions(auth.organizationId, {
      activeOnly,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) return authError;

    console.error("List contact fields failed", error);
    return jsonError("Failed to list contact fields", 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = createContactFieldDefinitionSchema.parse(body);
    const data = await createContactFieldDefinition(auth.organizationId, input);
    return NextResponse.json({ data }, { status: 201 });
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

    console.error("Create contact field failed", error);
    return jsonError("Failed to create contact field", 500);
  }
}
