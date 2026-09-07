import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { getActivityUpcoming } from "@/lib/activity/upcoming";

export const dynamic = "force-dynamic";

const upcomingQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  channel: z.enum(["SMS", "WHATSAPP", "EMAIL"]).optional(),
  occasionId: z.string().trim().min(1).max(100).optional(),
  categoryId: z.string().trim().min(1).max(100).optional(),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
    .optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await requireSessionAuth();
    const { searchParams } = new URL(request.url);
    const channelParam = searchParams.get("channel");
    const query = upcomingQuerySchema.parse({
      search: searchParams.get("search") ?? undefined,
      channel:
        channelParam === "SMS" ||
        channelParam === "WHATSAPP" ||
        channelParam === "EMAIL"
          ? channelParam
          : undefined,
      occasionId: searchParams.get("occasionId") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      date: searchParams.get("date") ?? undefined,
    });

    const result = await getActivityUpcoming(auth.organizationId, {
      search: query.search,
      channel: query.channel ?? "",
      occasionId: query.occasionId,
      categoryId: query.categoryId,
      date: query.date,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid upcoming query", 400, error.flatten());
    }

    console.error("Get activity upcoming failed", error);
    return jsonError("Failed to load upcoming greetings", 500);
  }
}
