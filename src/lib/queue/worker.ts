import { getOrganizationSendVelocityBudget } from "@/lib/abuse/velocity";
import {
  WORKER_CLAIM_BATCH_SIZE_PER_TENANT,
  WORKER_DRAIN_TIME_BUDGET_MS,
  WORKER_GLOBAL_SEND_CONCURRENCY,
  WORKER_LEASE_START_CUTOFF_MS,
  WORKER_TENANT_CONCURRENCY,
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
  /** Override how many organizations are processed at once (capped by WORKER_TENANT_CONCURRENCY). */
  tenantConcurrency?: number;
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

/** Caps how many async tasks run at once across every caller sharing it. */
function createLimiter(concurrency: number) {
  let active = 0;
  const waiting: Array<() => void> = [];

  return async function run<R>(task: () => Promise<R>): Promise<R> {
    while (active >= concurrency) {
      await new Promise<void>((resolve) => {
        waiting.push(resolve);
      });
    }

    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

/** Runs `handler` over `items` in order, at most `concurrency` at a time. */
async function forEachWithConcurrency<T>(
  items: T[],
  concurrency: number,
  handler: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;

  async function runner() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      await handler(items[current]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runner()),
  );
}

/**
 * Shared asynchronous message worker. Recovers leases, claims fairly per tenant,
 * and processes sends through processClaimedQueueItem (never calls providers
 * directly). Several tenants are worked at once so one tenant's slow provider
 * does not hold up the rest; provider calls across all of them share one
 * global concurrency cap. Production callers must not pass tenant/queue selectors from
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
  const tenantConcurrency = Math.max(
    1,
    Math.min(
      options.tenantConcurrency ?? WORKER_TENANT_CONCURRENCY,
      WORKER_TENANT_CONCURRENCY,
    ),
  );
  const limitSend = createLimiter(Math.max(1, concurrency));
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
  let hitLeaseCutoff = false;

  const processOrganization = async (organizationId: string) => {
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
        return;
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
      return;
    }

    if (claimed.length === 0) {
      summary.tenantsProcessed += 1;
      return;
    }

    summary.queuesClaimed += claimed.length;

    if (claimed.length >= claimLimit) {
      hitClaimCap = true;
    }

    const claimedAtMs = Date.now();

    const results = await Promise.all(
      claimed.map((row) =>
        limitSend(async (): Promise<SendQueueItemResult> => {
          // Waited too long for a send slot: leave the row for lease recovery
          // rather than start a provider call that could outlive its lease.
          if (Date.now() - claimedAtMs > WORKER_LEASE_START_CUTOFF_MS) {
            hitLeaseCutoff = true;
            return {
              queueId: row.id,
              status: "skipped",
              error: "Lease nearly expired before a send slot was free",
            };
          }

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
              status: "skipped",
              error: "Processing interrupted",
            };
          }
        }),
      ),
    );

    for (const result of results) {
      recordResult(summary, result);
    }

    summary.tenantsProcessed += 1;
  };

  await forEachWithConcurrency(
    boundedOrgIds,
    tenantConcurrency,
    processOrganization,
  );

  if (moreOrgsExist || hitClaimCap || hitVelocityPace || hitLeaseCutoff) {
    summary.processingIncomplete = true;
  }

  return summary;
}

export type MessageWorkerDrainSummary = MessageWorkerSummary & {
  /** Worker passes run in this drain. */
  passes: number;
};

/**
 * Runs worker passes back to back until nothing more can be sent right now or
 * the time budget is used. A pass that claimed nothing ends the drain: what is
 * left is waiting on a velocity window, a retry time or a send time.
 */
export async function drainMessageWorker(
  options: MessageWorkerOptions & {
    /** Stop starting new passes after this long (default WORKER_DRAIN_TIME_BUDGET_MS). */
    timeBudgetMs?: number;
  } = {},
): Promise<MessageWorkerDrainSummary> {
  const { timeBudgetMs = WORKER_DRAIN_TIME_BUDGET_MS, ...workerOptions } =
    options;
  const deadline = Date.now() + timeBudgetMs;
  const total: MessageWorkerDrainSummary = { ...emptySummary(), passes: 0 };

  while (true) {
    const pass = await runMessageWorker(workerOptions);

    total.passes += 1;
    total.tenantsConsidered = Math.max(
      total.tenantsConsidered,
      pass.tenantsConsidered,
    );
    total.tenantsProcessed = Math.max(
      total.tenantsProcessed,
      pass.tenantsProcessed,
    );
    total.queuesClaimed += pass.queuesClaimed;
    total.sendAttempts += pass.sendAttempts;
    total.sent += pass.sent;
    total.failed += pass.failed;
    total.retryScheduled += pass.retryScheduled;
    total.ambiguous += pass.ambiguous;
    total.skipped += pass.skipped;
    total.leasesRecoveredBeforeSubmission +=
      pass.leasesRecoveredBeforeSubmission;
    total.leasesFinalizedAmbiguous += pass.leasesFinalizedAmbiguous;
    total.processingIncomplete = pass.processingIncomplete;

    if (
      !pass.processingIncomplete ||
      pass.queuesClaimed === 0 ||
      Date.now() >= deadline
    ) {
      return total;
    }
  }
}
