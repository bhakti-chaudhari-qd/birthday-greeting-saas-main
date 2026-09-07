import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { listDeliveries } from "@/lib/deliveries/list";
import { listDeliveriesQuerySchema } from "@/lib/validation/send";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireSessionAuth();
    const { searchParams } = new URL(request.url);
    const query = listDeliveriesQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
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

    const result = await listDeliveries(auth.organizationId, query);

    return NextResponse.json(result);
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid query parameters", 400, error.flatten());
    }

    console.error("List deliveries failed", error);
    return jsonError("Failed to list deliveries", 500);
  }
}
