import {
  Channel,
  QueueStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  AMBIGUOUS_PROVIDER_OUTCOME,
  AMBIGUOUS_PROVIDER_OUTCOME_MESSAGE,
} from "@/lib/queue/constants";

const FAILED_QUEUE_LIMIT = 25;
const MAX_FAILURE_REASON_LENGTH = 160;

const SAFE_FAILURE_REASONS: Record<string, string> = {
  [AMBIGUOUS_PROVIDER_OUTCOME]: AMBIGUOUS_PROVIDER_OUTCOME_MESSAGE,
  INVALID_CREDENTIALS: "Provider credentials were rejected.",
  INVALID_RECIPIENT: "The recipient was rejected by the provider.",
  INVALID_SENDER_ID: "The configured sender was rejected by the provider.",
  INVALID_ROUTE: "The configured provider route was rejected.",
  MISSING_TEMPLATE_ID: "The provider template is not configured.",
  TEMPLATE_NOT_READY: "The provider template is not ready.",
  PROVIDER_HTTP_4XX: "The provider rejected the request.",
  PROVIDER_HTTP_5XX: "The provider was temporarily unavailable.",
  PROVIDER_TIMEOUT: "The provider request timed out.",
  RATE_LIMITED: "The provider rate limit was reached.",
  SEND_VELOCITY_LIMIT:
    "Organization send rate limit was reached; the worker will retry automatically.",
  SEND_FAILED: "Message delivery failed.",
  SUBMISSION_ERROR: "The provider did not accept the submission.",
  UNKNOWN_PROVIDER: "The configured provider is unsupported.",
};

export type PlatformFailedQueueDiagnostic = {
  id: string;
  channel: Channel;
  status: QueueStatus;
  attemptCount: number;
  failureReason: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Queue errors can contain arbitrary provider text. Only expose reviewed,
 * code-derived summaries; raw error text is deliberately never returned.
 */
export function safeFailureReason(errorCode: string | null): string {
  const reason = errorCode
    ? (SAFE_FAILURE_REASONS[errorCode] ?? "Message delivery failed.")
    : "Message delivery failed.";

  return reason
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FAILURE_REASON_LENGTH);
}

export async function listFailedQueueDiagnosticsForPlatformAdmin(
  organizationId: string,
): Promise<PlatformFailedQueueDiagnostic[]> {
  const queueItems = await prisma.sendQueue.findMany({
    where: {
      organizationId,
      status: QueueStatus.FAILED,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: FAILED_QUEUE_LIMIT,
    select: {
      id: true,
      channel: true,
      status: true,
      attemptCount: true,
      lastErrorCode: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return queueItems.map((queue) => ({
      id: queue.id,
      channel: queue.channel,
      status: queue.status,
      attemptCount: queue.attemptCount,
      failureReason: safeFailureReason(queue.lastErrorCode),
      createdAt: queue.createdAt.toISOString(),
      updatedAt: queue.updatedAt.toISOString(),
    }));
}
