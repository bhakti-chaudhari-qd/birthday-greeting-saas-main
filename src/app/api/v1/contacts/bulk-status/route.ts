import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { ContactLimitError } from "@/lib/contacts/errors";
import { bulkUpdateContactStatus } from "@/lib/contacts/service";
import { bulkUpdateContactStatusSchema } from "@/lib/validation/contact";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const auth = await requireSessionAuth();
    const body = await request.json();
    const input = bulkUpdateContactStatusSchema.parse(body);
    const result = await bulkUpdateContactStatus(auth.organizationId, input);

    return NextResponse.json({ data: result });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid bulk status input", 400, error.flatten());
    }

    if (error instanceof ContactLimitError) {
      return jsonError(error.message, 402);
    }

    console.error("Bulk update contact status failed", error);
    return jsonError("Failed to update contact status", 500);
  }
}
