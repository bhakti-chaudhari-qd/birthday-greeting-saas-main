import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { ContactDeleteBlockedError } from "@/lib/contacts/errors";
import { bulkDeleteContacts } from "@/lib/contacts/service";
import { bulkContactIdsSchema } from "@/lib/validation/contact";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAuth();
    const body = await request.json();
    const input = bulkContactIdsSchema.parse(body);
    const result = await bulkDeleteContacts(auth.organizationId, input);

    return NextResponse.json({ data: result });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid bulk delete input", 400, error.flatten());
    }

    if (error instanceof ContactDeleteBlockedError) {
      return jsonError(error.message, 409);
    }

    console.error("Bulk delete contacts failed", error);
    return jsonError("Failed to delete contacts", 500);
  }
}
