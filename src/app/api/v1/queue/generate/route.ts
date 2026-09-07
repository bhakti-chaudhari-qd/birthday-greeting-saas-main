import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { SubscriptionBlockedError } from "@/lib/abuse/subscription-send";
import { prisma } from "@/lib/db";
import {
  QueueTemplateNotFoundError,
  QueueTemplateRejectedError,
  QueueValidationError,
} from "@/lib/queue/errors";
import { generateOccasionQueue } from "@/lib/queue/generate";
import { scheduleMessageWorkerProcessing } from "@/lib/queue/schedule-worker";
import { generateQueueSchema } from "@/lib/validation/queue";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = generateQueueSchema.parse(body);

    const template = await prisma.messageTemplate.findFirst({
      where: { id: input.templateId, organizationId: auth.organizationId },
      select: { occasionId: true },
    });
    if (!template) {
      throw new QueueTemplateNotFoundError();
    }

    const summary = await generateOccasionQueue(
      auth.organizationId,
      template.occasionId,
      input,
    );

    if (summary.created > 0) {
      scheduleMessageWorkerProcessing();
    }

    return NextResponse.json({ data: summary }, { status: 201 });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid queue generation input", 400, error.flatten());
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

    console.error("Generate queue failed", error);
    return jsonError("Failed to generate queue", 500);
  }
}
