import { QueueStatus } from "@prisma/client";

import { STUCK_PENDING_THRESHOLD_MS } from "@/lib/queue/constants";
import { prisma } from "@/lib/db";

export type StuckPendingSummary = {
  count: number;
  thresholdMinutes: number;
};

/**
 * PENDING rows that have been waiting longer than the threshold and are due
 * to send now (not intentionally held for a future send window / retry).
 */
export async function getStuckPendingSummary(
  organizationId: string,
  now: Date = new Date(),
): Promise<StuckPendingSummary> {
  const cutoff = new Date(now.getTime() - STUCK_PENDING_THRESHOLD_MS);

  const count = await prisma.sendQueue.count({
    where: {
      organizationId,
      status: QueueStatus.PENDING,
      createdAt: { lte: cutoff },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      NOT: { lastErrorCode: "BEFORE_AUTOMATION_SEND_TIME" },
    },
  });

  return {
    count,
    thresholdMinutes: Math.round(STUCK_PENDING_THRESHOLD_MS / 60_000),
  };
}
