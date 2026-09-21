import { NextResponse } from "next/server";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { buildContactCsvTemplate } from "@/lib/contacts/csv";
import { listOccasions } from "@/lib/occasions/service";
import { withUtf8Bom } from "@/lib/csv-response";
import { getRequestLocale } from "@/lib/i18n/request-locale";

export const dynamic = "force-dynamic";

export async function GET(request?: Request) {
  try {
    const auth = await requireSessionAuth();
    const occasions = await listOccasions(auth.organizationId);

    return new NextResponse(withUtf8Bom(
        buildContactCsvTemplate(
          occasions,
          request ? getRequestLocale(request) : "en",
        ),
      ), {
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
