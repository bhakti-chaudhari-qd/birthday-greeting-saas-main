import type { MessageWorkerSummary } from "./worker";

/**
 * Formats a worker summary for local CLI output.
 * Does not include secrets, queue IDs, or organization IDs.
 */
export function formatMessageWorkerSummary(
  summary: MessageWorkerSummary,
): string {
  return [
    "Message worker drain complete",
    `tenantsConsidered: ${summary.tenantsConsidered}`,
    `tenantsProcessed: ${summary.tenantsProcessed}`,
    `queuesClaimed: ${summary.queuesClaimed}`,
    `sendAttempts: ${summary.sendAttempts}`,
    `sent: ${summary.sent}`,
    `failed: ${summary.failed}`,
    `retryScheduled: ${summary.retryScheduled}`,
    `ambiguous: ${summary.ambiguous}`,
    `skipped: ${summary.skipped}`,
    `leasesRecoveredBeforeSubmission: ${summary.leasesRecoveredBeforeSubmission}`,
    `leasesFinalizedAmbiguous: ${summary.leasesFinalizedAmbiguous}`,
    `processingIncomplete: ${summary.processingIncomplete}`,
  ].join("\n");
}
