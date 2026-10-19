import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  QueueInvalidStateError,
  QueueMaxAttemptsError,
  QueueNotFoundError,
} from "@/lib/queue/errors";
import { scheduleMessageWorkerProcessing } from "@/lib/queue/schedule-worker";
import { scheduleQueueRetry } from "@/lib/queue/send";
import { retryQueueSchema } from "@/lib/validation/send";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAdmin();
    const { id } = await context.params;

    let body: unknown = {};
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        body = await request.json();
      } catch {
        body = {};
      }
    }

    const input = retryQueueSchema.parse(body ?? {});
    const result = await scheduleQueueRetry(auth.organizationId, id, {
      confirmAmbiguousRetry: input.confirmAmbiguousRetry,
    });

    scheduleMessageWorkerProcessing();

    return NextResponse.json({ data: result });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid retry request", 400, error.flatten());
    }

    if (error instanceof QueueNotFoundError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof QueueInvalidStateError) {
      return jsonError(error.message, 400);
    }

    if (error instanceof QueueMaxAttemptsError) {
      return jsonError(error.message, 400);
    }

    console.error("Retry queue item failed", error);
    return jsonError("Failed to retry queue item", 500);
  }
}
