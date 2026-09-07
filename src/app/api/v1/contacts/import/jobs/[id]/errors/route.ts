import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { z } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  ContactImportJobNotFoundError,
  listContactImportJobErrors,
} from "@/lib/contacts/import-jobs";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const result = await listContactImportJobErrors(
      auth.organizationId,
      id,
      query,
    );

    return NextResponse.json(result);
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ContactImportJobNotFoundError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid query parameters", 400, error.flatten());
    }

    console.error("List import job errors failed", error);
    return jsonError("Failed to load import errors", 500);
  }
}
