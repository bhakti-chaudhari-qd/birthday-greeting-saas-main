import { DeliveryStatus, QueueStatus } from "@prisma/client";

import { prisma } from "@/lib/db";

import {
  AMBIGUOUS_PROVIDER_OUTCOME,
  AMBIGUOUS_PROVIDER_OUTCOME_MESSAGE,
  MAX_SEND_ATTEMPTS,
} from "./constants";

export type LeaseRecoverySummary = {
  recoveredBeforeSubmission: number;
  finalizedAmbiguous: number;
};

/**
 * Recover expired SENDING leases.
 *
 * - providerAttemptStartedAt IS NULL → return to PENDING (attemptCount 0) or
 *   FAILED (attemptCount > 0) without incrementing attempts or writing logs.
 * - providerAttemptStartedAt set → finalize AMBIGUOUS_PROVIDER_OUTCOME once.
 *
 * Concurrency: CAS updateMany ensures only one worker finalizes each row.
 */
export async function recoverExpiredLeases(
  options: { now?: Date; limit?: number } = {},
): Promise<LeaseRecoverySummary> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 500;

  const expired = await prisma.sendQueue.findMany({
    where: {
      status: QueueStatus.SENDING,
      leaseExpiresAt: { lt: now },
    },
    orderBy: [{ leaseExpiresAt: "asc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
      organizationId: true,
      attemptCount: true,
      providerAttemptStartedAt: true,
    },
  });

  let recoveredBeforeSubmission = 0;
  let finalizedAmbiguous = 0;

  for (const row of expired) {
    if (row.providerAttemptStartedAt == null) {
      const restoreStatus =
        row.attemptCount === 0 ? QueueStatus.PENDING : QueueStatus.FAILED;

      const updated = await prisma.sendQueue.updateMany({
        where: {
          id: row.id,
          organizationId: row.organizationId,
          status: QueueStatus.SENDING,
          leaseExpiresAt: { lt: now },
          providerAttemptStartedAt: null,
        },
        data: {
          status: restoreStatus,
          claimedAt: null,
          leaseExpiresAt: null,
          providerAttemptStartedAt: null,
          // Immediate reclaim for interrupted retries; PENDING rows may use
          // nextAttemptAt to hold until the automation send window opens.
          nextAttemptAt: restoreStatus === QueueStatus.FAILED ? now : null,
          lastError: null,
          lastErrorCode: null,
        },
      });

      if (updated.count === 1) {
        recoveredBeforeSubmission += 1;
      }

      continue;
    }

    const attemptNumber = Math.min(row.attemptCount + 1, MAX_SEND_ATTEMPTS);

    const finalized = await prisma.$transaction(async (tx) => {
      const claimed = await tx.sendQueue.updateMany({
        where: {
          id: row.id,
          organizationId: row.organizationId,
          status: QueueStatus.SENDING,
          leaseExpiresAt: { lt: now },
          providerAttemptStartedAt: { not: null },
        },
        data: {
          status: QueueStatus.FAILED,
          attemptCount: attemptNumber,
          lastError: AMBIGUOUS_PROVIDER_OUTCOME_MESSAGE,
          lastErrorCode: AMBIGUOUS_PROVIDER_OUTCOME,
          claimedAt: null,
          leaseExpiresAt: null,
          providerAttemptStartedAt: null,
          nextAttemptAt: null,
        },
      });

      if (claimed.count !== 1) {
        return false;
      }

      await tx.deliveryLog.create({
        data: {
          organizationId: row.organizationId,
          sendQueueId: row.id,
          attemptNumber,
          status: DeliveryStatus.FAILED,
          errorCode: AMBIGUOUS_PROVIDER_OUTCOME,
          errorMessage: AMBIGUOUS_PROVIDER_OUTCOME_MESSAGE,
          providerResponse: { recovery: "expired_lease_after_provider_start" },
        },
      });

      return true;
    });

    if (finalized) {
      finalizedAmbiguous += 1;
    }
  }

  return { recoveredBeforeSubmission, finalizedAmbiguous };
}
