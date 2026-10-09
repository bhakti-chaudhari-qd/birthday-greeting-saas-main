import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  DAILY_SUMMARY_MAX_RECIPIENTS,
  DailySummaryValidationError,
  getDailySummarySettings,
  updateDailySummarySettings,
} from "@/lib/daily-summary/service";

export const dynamic = "force-dynamic";

const updateSchema = z
  .object({
    enabled: z.boolean(),
    recipients: z
      .array(z.string().trim().min(1).max(20))
      .max(DAILY_SUMMARY_MAX_RECIPIENTS),
  })
  .strict();

/** Owner-only: who receives the daily WhatsApp summary, and whether it is on. */
export async function GET() {
  try {
    const auth = await requireSessionAdmin();

    return NextResponse.json({
      data: await getDailySummarySettings(auth.organizationId),
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Get daily summary settings failed", error);
    return jsonError("Failed to load setting", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const input = updateSchema.parse(await request.json());

    return NextResponse.json({
      data: await updateDailySummarySettings(auth.organizationId, input),
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid input", 400, error.flatten());
    }

    if (error instanceof DailySummaryValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Update daily summary settings failed", error);
    return jsonError("Failed to save setting", 500);
  }
}
