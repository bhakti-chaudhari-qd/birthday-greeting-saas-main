import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  OccasionConflictError,
  OccasionValidationError,
  createOccasion,
  listOccasions,
} from "@/lib/occasions/service";
import { createOccasionSchema } from "@/lib/occasions/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAuth();
    const data = await listOccasions(auth.organizationId);
    return NextResponse.json({ data });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("List occasions failed", error);
    return jsonError("Failed to list occasions", 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = createOccasionSchema.parse(body);
    const data = await createOccasion(auth.organizationId, input.name);
    return NextResponse.json({ data }, { status: 201 });
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

    if (error instanceof OccasionConflictError) {
      return jsonError(error.message, 409);
    }

    console.error("Create occasion failed", error);
    return jsonError("Failed to create occasion", 500);
  }
}
