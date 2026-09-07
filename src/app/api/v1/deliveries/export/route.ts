import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { exportDeliveriesCsv } from "@/lib/deliveries/export";
import { exportDeliveriesQuerySchema } from "@/lib/validation/send";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const { searchParams } = new URL(request.url);
    const query = exportDeliveriesQuerySchema.parse({
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      channel: searchParams.get("channel") ?? undefined,
      provider: searchParams.get("provider") ?? undefined,
      sendQueueId: searchParams.get("sendQueueId") ?? undefined,
      queueStatus: searchParams.get("queueStatus") ?? undefined,
      outcome: searchParams.get("outcome") ?? undefined,
      occasionId: searchParams.get("occasionId") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      scheduledDate: searchParams.get("scheduledDate") ?? undefined,
    });

    const result = await exportDeliveriesCsv(auth.organizationId, query);

    const headers = new Headers({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="submitted-history.csv"',
      "Cache-Control": "no-store",
      "X-Delivery-Export-Total": String(result.total),
      "X-Delivery-Export-Truncated": result.truncated ? "true" : "false",
    });

    return new NextResponse(result.csv, { status: 200, headers });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid query parameters", 400, error.flatten());
    }

    console.error("Export deliveries failed", error);
    return jsonError("Failed to export submitted history", 500);
  }
}
