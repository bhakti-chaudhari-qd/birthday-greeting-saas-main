import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { getOccasionsDayView } from "@/lib/queue/occasions-day-view";
import { occasionsDayQuerySchema } from "@/lib/validation/occasions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireSessionAuth();
    const { searchParams } = new URL(request.url);
    const query = occasionsDayQuerySchema.parse({
      date: searchParams.get("date") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
    });

    const view = await getOccasionsDayView(
      auth.organizationId,
      query.date,
      query.categoryId,
    );

    return NextResponse.json({ data: view });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid occasions query", 400, error.flatten());
    }

    if (error instanceof Error && error.message.includes("Target date")) {
      return jsonError(error.message, 400);
    }

    console.error("Get occasions day view failed", error);
    return jsonError("Failed to load occasions for this day", 500);
  }
}