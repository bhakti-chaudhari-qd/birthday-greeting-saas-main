import { NextResponse } from "next/server";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  ContactImportJobNotFoundError,
  getContactImportJobForOrganization,
} from "@/lib/contacts/import-jobs";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    const job = await getContactImportJobForOrganization(auth.organizationId, id);

    return NextResponse.json({ data: job });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ContactImportJobNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Get import job failed", error);
    return jsonError("Failed to load import job", 500);
  }
}
