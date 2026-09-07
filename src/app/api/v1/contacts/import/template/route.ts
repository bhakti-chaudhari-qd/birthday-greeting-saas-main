import { NextResponse } from "next/server";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { buildContactCsvTemplate } from "@/lib/contacts/csv";
import { listOccasions } from "@/lib/occasions/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAuth();
    const occasions = await listOccasions(auth.organizationId);

    return new NextResponse(buildContactCsvTemplate(occasions), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="contacts-template.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Contact CSV template failed", error);
    return jsonError("Failed to download CSV template", 500);
  }
}
