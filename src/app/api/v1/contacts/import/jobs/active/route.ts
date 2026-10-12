import { NextResponse } from "next/server";

import {
  requireApiAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/api-auth";
import { jsonError } from "@/lib/api/response";
import { getActiveImportJobForOrganization } from "@/lib/contacts/import-jobs";

export const dynamic = "force-dynamic";

export async function GET(request?: Request) {
  try {
    const auth = await requireApiAuth(request);
    const job = await getActiveImportJobForOrganization(auth.organizationId);

    return NextResponse.json({
      data: job
        ? {
            id: job.id,
            status: job.status,
            fileName: job.fileName,
            totalRows: job.totalRows,
            processedRows: job.processedRows,
            created: job.created,
            updated: job.updated,
            skippedDuplicate: job.skippedDuplicate,
            skippedLimit: job.skippedLimit,
            invalid: job.invalid,
          }
        : null,
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Get active import job failed", error);
    return jsonError("Failed to load import status", 500);
  }
}
