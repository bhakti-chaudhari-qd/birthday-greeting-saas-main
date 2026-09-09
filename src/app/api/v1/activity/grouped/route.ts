import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { getGroupedActivity } from "@/lib/activity/grouped";

export const dynamic = "force-dynamic";

const groupedQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(["all", "sent", "failed", "pending"]).optional(),
  channel: z.enum(["SMS", "WHATSAPP", "EMAIL"]).optional(),
  occasionId: z.string().trim().min(1).max(100).optional(),
  categoryId: z.string().trim().min(1).max(100).optional(),
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
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
    const statusParam = searchParams.get("status");
    const query = groupedQuerySchema.parse({
      search: searchParams.get("search") ?? undefined,
      status:
        statusParam === "all" ||
        statusParam === "sent" ||
        statusParam === "failed" ||
        statusParam === "pending"
          ? statusParam
          : undefined,
      channel:
        channelParam === "SMS" ||
        channelParam === "WHATSAPP" ||
        channelParam === "EMAIL"
          ? channelParam
          : undefined,
      occasionId: searchParams.get("occasionId") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      date: searchParams.get("date") ?? undefined,
    });

    const result = await getGroupedActivity(auth.organizationId, query);

    return NextResponse.json({ data: result });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid activity query", 400, error.flatten());
    }

    console.error("Get grouped activity failed", error);
    return jsonError("Failed to load activity", 500);
  }
}
