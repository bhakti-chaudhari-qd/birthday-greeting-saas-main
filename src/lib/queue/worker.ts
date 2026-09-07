import { getOrganizationSendVelocityBudget } from "@/lib/abuse/velocity";
import {
  WORKER_CLAIM_BATCH_SIZE_PER_TENANT,
  WORKER_GLOBAL_SEND_CONCURRENCY,
} from "./constants";
import {
  claimQueueItemsForOrganization,
  listOrganizationsWithClaimableWork,
} from "./claim";
import { recoverExpiredLeases } from "./recover";
import {
  processClaimedQueueItem,
  type ProcessQueueItemOptions,
  type SendQueueItemResult,
} from "./send";

export type MessageWorkerOptions = ProcessQueueItemOptions & {
  /** Max organizations to consider in one invocation (deterministic prefix). */
  maxOrganizations?: number;
  /** Override per-tenant claim batch size (capped by WORKER_CLAIM_BATCH_SIZE_PER_TENANT). */
  claimBatchSizePerTenant?: number;
  /** Override global send concurrency (capped by WORKER_GLOBAL_SEND_CONCURRENCY). */
  globalSendConcurrency?: number;
};

export type MessageWorkerSummary = {
  tenantsConsidered: number;
  tenantsProcessed: number;
  queuesClaimed: number;
  sendAttempts: number;
  sent: number;
  failed: number;
  retryScheduled: number;
  ambiguous: number;
  skipped: number;
  leasesRecoveredBeforeSubmission: number;
  leasesFinalizedAmbiguous: number;
  /**
   * True when claimable work likely remains because this invocation hit
   * organization/claim bounds or a processing interruption - not merely because
   * future nextAttemptAt rows, terminal failures, or ambiguous rows exist.
   */
  processingIncomplete: boolean;
};

function emptySummary(): MessageWorkerSummary {
  return {
    tenantsConsidered: 0,
    tenantsProcessed: 0,
    queuesClaimed: 0,
    sendAttempts: 0,
    sent: 0,
    failed: 0,
    retryScheduled: 0,
    ambiguous: 0,
    skipped: 0,
    leasesRecoveredBeforeSubmission: 0,
    leasesFinalizedAmbiguous: 0,
    processingIncomplete: false,
  };
}

function recordResult(
  summary: MessageWorkerSummary,
  result: SendQueueItemResult,
) {
  summary.sendAttempts += 1;

  switch (result.status) {
    case "sent":
      summary.sent += 1;
      break;
    case "failed":
      summary.failed += 1;
      break;
    case "retry_scheduled":
      summary.retryScheduled += 1;
      break;
    case "ambiguous":
      summary.ambiguous += 1;
      break;
    case "skipped":
      summary.skipped += 1;
      break;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current]!);
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(runners);
  return results;
}

/**
 * Shared asynchronous message worker. Recovers leases, claims fairly per tenant,
 * and processes sends through processClaimedQueueItem (never calls providers
 * directly). Production callers must not pass tenant/queue selectors from
 * untrusted input - test options only adjust bounds/time/randomness.
 */
export async function runMessageWorker(
  options: MessageWorkerOptions = {},
): Promise<MessageWorkerSummary> {
  const summary = emptySummary();
  const claimLimit = Math.min(
    options.claimBatchSizePerTenant ?? WORKER_CLAIM_BATCH_SIZE_PER_TENANT,
    WORKER_CLAIM_BATCH_SIZE_PER_TENANT,
  );
  const concurrency = Math.min(
    options.globalSendConcurrency ?? WORKER_GLOBAL_SEND_CONCURRENCY,
    WORKER_GLOBAL_SEND_CONCURRENCY,
  );
  const maxOrganizations = options.maxOrganizations ?? 1000;

  const recovery = await recoverExpiredLeases({ now: options.now });
  summary.leasesRecoveredBeforeSubmission = recovery.recoveredBeforeSubmission;
  summary.leasesFinalizedAmbiguous = recovery.finalizedAmbiguous;

  const organizationIds = await listOrganizationsWithClaimableWork({
    now: options.now,
    limit: maxOrganizations + 1,
  });

  summary.tenantsConsidered = Math.min(organizationIds.length, maxOrganizations);
  const boundedOrgIds = organizationIds.slice(0, maxOrganizations);
  const moreOrgsExist = organizationIds.length > maxOrganizations;

  let hitClaimCap = false;
  let hitVelocityPace = false;

  for (const organizationId of boundedOrgIds) {
    let claimed: Array<{ id: string; organizationId: string }> = [];

    try {
      const budget = await getOrganizationSendVelocityBudget(
        organizationId,
        options.now,
      );

      if (budget.remaining <= 0) {
        // Work may still exist; wait for the velocity window to reopen.
        hitVelocityPace = true;
        summary.tenantsProcessed += 1;
        continue;
      }

      const pacedLimit = Math.min(claimLimit, budget.remaining);

      claimed = await claimQueueItemsForOrganization(organizationId, {
        now: options.now,
        limit: pacedLimit,
      });

      if (claimed.length >= pacedLimit && pacedLimit < claimLimit) {
        hitVelocityPace = true;
      }
    } catch (error) {
      console.error("Worker claim failed for organization", {
        organizationId,
        error: error instanceof Error ? error.message : "unknown",
      });
      summary.processingIncomplete = true;
      continue;
    }

    if (claimed.length === 0) {
      summary.tenantsProcessed += 1;
      continue;
    }

    summary.queuesClaimed += claimed.length;

    if (claimed.length >= claimLimit) {
      hitClaimCap = true;
    }

    const results = await mapWithConcurrency(
      claimed,
      concurrency,
      async (row) => {
        try {
          return await processClaimedQueueItem(row.organizationId, row.id, {
            now: options.now,
            random: options.random,
          });
        } catch (error) {
          console.error("Worker send failed for queue item", {
            organizationId: row.organizationId,
            queueId: row.id,
            error: error instanceof Error ? error.message : "unknown",
          });
          return {
            queueId: row.id,
            status: "skipped" as const,
            error: "Processing interrupted",
          };
        }
      },
    );

    for (const result of results) {
      recordResult(summary, result);
    }

    summary.tenantsProcessed += 1;
  }

  if (moreOrgsExist || hitClaimCap || hitVelocityPace) {
    summary.processingIncomplete = true;
  }

  return summary;
}
