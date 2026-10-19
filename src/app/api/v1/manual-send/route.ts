import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { SubscriptionBlockedError } from "@/lib/abuse/subscription-send";
import {
  QueueTemplateNotFoundError,
  QueueTemplateRejectedError,
  QueueValidationError,
} from "@/lib/queue/errors";
import { executeManualSend } from "@/lib/queue/manual-send";
import { scheduleMessageWorkerProcessing } from "@/lib/queue/schedule-worker";
import { manualSendRequestSchema } from "@/lib/validation/manual-send";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = manualSendRequestSchema.parse(body);
    const result = await executeManualSend(auth.organizationId, input, {
      createdByUserId: auth.userId,
    });

    if (result.creation.created > 0) {
      scheduleMessageWorkerProcessing();
    }

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid manual send request", 400, error.flatten());
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

    console.error("Manual send failed", error);
    return jsonError("Failed to send messages", 500);
  }
}
