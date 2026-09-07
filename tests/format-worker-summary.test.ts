import { describe, expect, it } from "vitest";

import { formatMessageWorkerSummary } from "@/lib/queue/format-worker-summary";
import type { MessageWorkerSummary } from "@/lib/queue/worker";

function sampleSummary(
  overrides: Partial<MessageWorkerSummary> = {},
): MessageWorkerSummary {
  return {
    tenantsConsidered: 2,
    tenantsProcessed: 1,
    queuesClaimed: 3,
    sendAttempts: 3,
    sent: 2,
    failed: 0,
    retryScheduled: 1,
    ambiguous: 0,
    skipped: 0,
    leasesRecoveredBeforeSubmission: 0,
    leasesFinalizedAmbiguous: 0,
    processingIncomplete: false,
    ...overrides,
  };
}

describe("formatMessageWorkerSummary", () => {
  it("prints aggregate counts without org, queue, or secret fields", () => {
    const text = formatMessageWorkerSummary(sampleSummary());

    expect(text).toContain("Message worker drain complete");
    expect(text).toContain("tenantsConsidered: 2");
    expect(text).toContain("queuesClaimed: 3");
    expect(text).toContain("sent: 2");
    expect(text).toContain("retryScheduled: 1");
    expect(text).toContain("processingIncomplete: false");

    expect(text.toLowerCase()).not.toContain("organization");
    expect(text.toLowerCase()).not.toContain("cron");
    expect(text.toLowerCase()).not.toContain("secret");
    expect(text).not.toMatch(/queueId/i);
  });
});
