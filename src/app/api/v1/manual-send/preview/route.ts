import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  QueueTemplateNotFoundError,
  QueueTemplateRejectedError,
  QueueValidationError,
} from "@/lib/queue/errors";
import { previewManualSend } from "@/lib/queue/manual-send";
import { manualSendPreviewRequestSchema } from "@/lib/validation/manual-send";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = manualSendPreviewRequestSchema.parse(body);
    const preview = await previewManualSend(auth.organizationId, input);

    return NextResponse.json({ data: preview });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid manual send preview request", 400, error.flatten());
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

    console.error("Manual send preview failed", error);
    return jsonError("Failed to preview manual send", 500);
  }
}
