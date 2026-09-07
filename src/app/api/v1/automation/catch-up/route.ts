import { NextResponse } from "next/server";
import { z } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { SubscriptionBlockedError } from "@/lib/abuse/subscription-send";
import { catchUpMissedGreetings } from "@/lib/automation/catch-up";
import {
  QueueTemplateNotFoundError,
  QueueTemplateRejectedError,
  QueueValidationError,
} from "@/lib/queue/errors";
import { scheduleMessageWorkerProcessing } from "@/lib/queue/schedule-worker";

export const dynamic = "force-dynamic";

const catchUpSchema = z
  .object({
    targetDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Target date must use YYYY-MM-DD format")
      .optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json().catch(() => ({}));
    const input = catchUpSchema.parse(body ?? {});

    const summary = await catchUpMissedGreetings(auth.organizationId, input);

    if (summary.created > 0) {
      scheduleMessageWorkerProcessing();
    }

    return NextResponse.json({ data: summary }, { status: 201 });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof z.ZodError) {
      return jsonError("Invalid catch-up request", 400, error.flatten());
    }

    if (error instanceof SubscriptionBlockedError) {
      return jsonError(error.message, 402);
    }

    if (error instanceof QueueValidationError) {
      return jsonError(error.message, 400);
    }

    if (error instanceof QueueTemplateNotFoundError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof QueueTemplateRejectedError) {
      return jsonError(error.message, 400);
    }

    console.error("Automation catch-up failed", error);
    return jsonError("Failed to catch up missed greetings", 500);
  }
}
