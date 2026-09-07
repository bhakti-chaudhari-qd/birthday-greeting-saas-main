import { NextResponse } from "next/server";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { listStarterTemplatesForOrganization } from "@/lib/templates/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAuth();

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
