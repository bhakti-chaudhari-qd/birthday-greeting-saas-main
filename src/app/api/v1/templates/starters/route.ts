import { NextResponse } from "next/server";

import {
  requireApiAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/api-auth";
import { jsonError } from "@/lib/api/response";
import { listStarterTemplatesForOrganization } from "@/lib/templates/service";

export const dynamic = "force-dynamic";

export async function GET(request?: Request) {
  try {
    const auth = await requireApiAuth(request);

    return NextResponse.json({
      data: await listStarterTemplatesForOrganization(auth.organizationId),
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("List starter templates failed", error);
    return jsonError("Failed to list starter templates", 500);
  }
}
