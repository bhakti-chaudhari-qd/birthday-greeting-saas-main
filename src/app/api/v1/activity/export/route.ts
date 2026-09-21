import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { exportActivityCsv } from "@/lib/activity/export";
import { exportActivityQuerySchema } from "@/lib/validation/activity-export";
import { withUtf8Bom } from "@/lib/csv-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const { searchParams } = new URL(request.url);
    const channelParam = searchParams.get("channel");
    const query = exportActivityQuerySchema.parse({
      tab: searchParams.get("tab") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      channel:
        channelParam === "SMS" ||
        channelParam === "WHATSAPP" ||
        channelParam === "EMAIL"
          ? channelParam
          : undefined,
      occasionId: searchParams.get("occasionId") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
    });

    const result = await exportActivityCsv(auth.organizationId, query);

    const headers = new Headers({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
      "X-Activity-Export-Total": String(result.total),
      "X-Activity-Export-Truncated": result.truncated ? "true" : "false",
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

    console.error("Export activity failed", error);
    return jsonError("Failed to export activity", 500);
  }
}
