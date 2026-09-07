import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { listQueue } from "@/lib/queue/list";
import { listQueueQuerySchema } from "@/lib/validation/queue";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireSessionAuth();
    const { searchParams } = new URL(request.url);
    const query = listQueueQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      channel: searchParams.get("channel") ?? undefined,
      occasionId: searchParams.get("occasionId") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      scheduledDate: searchParams.get("scheduledDate") ?? undefined,
    });

    const result = await listQueue(auth.organizationId, query);

    return NextResponse.json(result);
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid query parameters", 400, error.flatten());
    }

    console.error("List queue failed", error);
    return jsonError("Failed to list queue", 500);
  }
}
