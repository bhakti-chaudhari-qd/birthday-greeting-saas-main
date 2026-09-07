-- High-scale messaging: lease, retry, and ambiguity tracking on SendQueue.
-- Nullable columns keep existing rows valid without backfill.

ALTER TABLE "SendQueue" ADD COLUMN "lastErrorCode" TEXT;
ALTER TABLE "SendQueue" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "SendQueue" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
ALTER TABLE "SendQueue" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);
ALTER TABLE "SendQueue" ADD COLUMN "providerAttemptStartedAt" TIMESTAMP(3);

-- Claimable PENDING / retryable FAILED selection (tenant-fair workers)
CREATE INDEX "SendQueue_status_nextAttemptAt_organizationId_createdAt_idx"
  ON "SendQueue"("status", "nextAttemptAt", "organizationId", "createdAt");

-- Expired SENDING lease recovery
CREATE INDEX "SendQueue_status_leaseExpiresAt_idx"
  ON "SendQueue"("status", "leaseExpiresAt");

-- Per-tenant claim ordering
CREATE INDEX "SendQueue_organizationId_status_nextAttemptAt_createdAt_idx"
  ON "SendQueue"("organizationId", "status", "nextAttemptAt", "createdAt");
