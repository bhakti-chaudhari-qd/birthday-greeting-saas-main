import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  PLATFORM_ADMIN_AUDIT_ACTIONS,
  createPlatformAdminAuditEvent,
} from "@/lib/admin/audit";
import { jsonError } from "@/lib/api/response";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import { prisma } from "@/lib/db";
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
  params: Promise<{ id: string; queueId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id, queueId } = await context.params;
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
    const result = await prisma.$transaction(async (tx) => {
      const scheduled = await scheduleQueueRetry(
        id,
        queueId,
        {
          confirmAmbiguousRetry: input.confirmAmbiguousRetry,
        },
        tx,
      );
      await createPlatformAdminAuditEvent(
        {
          actorAdminId: admin.adminId,
          organizationId: id,
          action: PLATFORM_ADMIN_AUDIT_ACTIONS.QUEUE_RETRY_SCHEDULED,
          targetType: "send_queue",
          targetId: queueId,
          after: { status: "scheduled" },
          metadata: {
            confirmedAmbiguousRetry:
              input.confirmAmbiguousRetry === true,
          },
        },
        tx,
      );
      return scheduled;
    });

    scheduleMessageWorkerProcessing();

    return NextResponse.json({
      data: {
        queueId: result.queueId,
        status: result.status,
        warning: result.warning ?? null,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid retry request", 400, error.flatten());
    }

    if (error instanceof QueueNotFoundError) {
      return jsonError(error.message, 404);
    }

    if (
      error instanceof QueueInvalidStateError ||
      error instanceof QueueMaxAttemptsError
    ) {
      return jsonError(error.message, 400);
    }

    console.error("Platform admin retry queue item failed", error);
    return jsonError("Failed to retry queue item", 500);
  }
}
