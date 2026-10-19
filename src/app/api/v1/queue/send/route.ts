import { QueueStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { scheduleMessageWorkerProcessing } from "@/lib/queue/schedule-worker";
import { sendQueueSchema } from "@/lib/validation/send";

export const dynamic = "force-dynamic";

/**
 * Confirms selected PENDING queue items remain queued for background workers.
 * Does not call providers synchronously.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = sendQueueSchema.parse(body);

    const items = await prisma.sendQueue.findMany({
      where: {
        organizationId: auth.organizationId,
        id: { in: input.queueIds },
      },
      select: { id: true, status: true },
    });

    const byId = new Map(items.map((item) => [item.id, item]));
    let queued = 0;
    let skipped = 0;
    const results = input.queueIds.map((queueId) => {
      const item = byId.get(queueId);
      if (!item) {
        skipped += 1;
        return {
          queueId,
          status: "skipped" as const,
          error: "Queue item not found",
        };
      }

      if (item.status === QueueStatus.PENDING) {
        queued += 1;
        return { queueId, status: "queued" as const };
      }

      skipped += 1;
      return {
        queueId,
        status: "skipped" as const,
        error: "Queue item is not pending",
      };
    });

    if (queued > 0) {
      scheduleMessageWorkerProcessing();
    }

    return NextResponse.json({
      data: {
        requested: input.queueIds.length,
        queued,
        skipped,
        message:
          "Selected pending messages remain queued for background processing",
        results,
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid send request", 400, error.flatten());
    }

    console.error("Batch queue acknowledge failed", error);
    return jsonError("Failed to acknowledge queue items", 500);
  }
}
