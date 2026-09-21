import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  exportContactsCsv,
  exportContactsCsvByIds,
} from "@/lib/contacts/export";
import { bulkContactIdsSchema } from "@/lib/validation/contact";
import { exportContactsQuerySchema } from "@/lib/validation/contact-csv";
import { withUtf8Bom } from "@/lib/csv-response";
import { getRequestLocale } from "@/lib/i18n/request-locale";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const { searchParams } = new URL(request.url);
    const query = exportContactsQuerySchema.parse({
      search: searchParams.get("search") ?? undefined,
      isActive: searchParams.get("isActive") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      occasionId: searchParams.get("occasionId") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
    });

    const result = await exportContactsCsv(
      auth.organizationId,
      query,
      getRequestLocale(request),
    );

    const headers = new Headers({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contacts.csv"',
      "Cache-Control": "no-store",
      "X-Contact-Export-Total": String(result.total),
      "X-Contact-Export-Truncated": result.truncated ? "true" : "false",
      ...(result.nextCursor
        ? { "X-Contact-Export-Next-Cursor": result.nextCursor }
        : {}),
    });

    return new NextResponse(withUtf8Bom(result.csv), { status: 200, headers });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid query parameters", 400, error.flatten());
    }

    console.error("Export contacts failed", error);
    return jsonError("Failed to export contacts", 500);
  }
}

/** Export only the given contact IDs (Owner-only). */
export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = bulkContactIdsSchema.parse(body);
    const result = await exportContactsCsvByIds(
      auth.organizationId,
      input.ids,
      getRequestLocale(request),
    );

    const headers = new Headers({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contacts-selected.csv"',
      "Cache-Control": "no-store",
      "X-Contact-Export-Total": String(result.total),
      "X-Contact-Export-Truncated": result.truncated ? "true" : "false",
    });

    return new NextResponse(withUtf8Bom(result.csv), { status: 200, headers });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid export input", 400, error.flatten());
    }

    console.error("Export selected contacts failed", error);
    return jsonError("Failed to export contacts", 500);
  }
}
