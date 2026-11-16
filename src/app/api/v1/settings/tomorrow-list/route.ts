import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  TOMORROW_LIST_MAX_RECIPIENTS,
  TomorrowListValidationError,
  getTomorrowListSettings,
  updateTomorrowListSettings,
} from "@/lib/tomorrow-list/service";

export const dynamic = "force-dynamic";

const updateSchema = z
  .object({
    enabled: z.boolean(),
    recipients: z
      .array(z.string().trim().min(1).max(20))
      .max(TOMORROW_LIST_MAX_RECIPIENTS),
    sendHour: z.number().int().min(0).max(23).nullable().optional(),
  })
  .strict();

/**
 * Owner-only: who receives the day-before Tomorrow's List link, at what hour, and
 * whether it is on.
 */
export async function GET() {
  try {
    const auth = await requireSessionAdmin();

    return NextResponse.json({
      data: await getTomorrowListSettings(auth.organizationId),
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Get tomorrow list settings failed", error);
    return jsonError("Failed to load setting", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const input = updateSchema.parse(await request.json());

    return NextResponse.json({
      data: await updateTomorrowListSettings(auth.organizationId, input),
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid input", 400, error.flatten());
    }

    if (error instanceof TomorrowListValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Update tomorrow list settings failed", error);
    return jsonError("Failed to save setting", 500);
  }
}
