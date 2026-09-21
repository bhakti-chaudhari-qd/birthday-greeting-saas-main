import { Prisma, QueueStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  getOrganizationLocalIsoDate,
  parseTargetDate,
} from "@/lib/queue/dates";

import { RETRYABLE_ERROR_CODES } from "./classify";
import {
  AMBIGUOUS_PROVIDER_OUTCOME,
  DOCUMENT_PREPARATION_GRACE_MS,
  MAX_SEND_ATTEMPTS,
  QUEUE_LEASE_DURATION_MS,
  USAGE_PERIOD_TIMEZONE,
  WORKER_CLAIM_BATCH_SIZE_PER_TENANT,
} from "./constants";
import { utcTimestampSql } from "./sql-time";

export type ClaimedQueueRow = {
  id: string;
  organizationId: string;
};

/**
 * Excludes rows still waiting for their personalized PDF (see
 * DOCUMENT_PREPARATION_GRACE_MS). `alias` is the SendQueue alias in scope.
 */
function notAwaitingDocumentSql(alias: string, now: Date) {
  const graceCutoffSql = utcTimestampSql(
    new Date(now.getTime() - DOCUMENT_PREPARATION_GRACE_MS),
  );
  const col = (name: string) => Prisma.raw(`${alias}."${name}"`);

  return Prisma.sql`
    AND NOT (
      ${col("generatedDocumentId")} IS NULL
      AND ${col("createdAt")} > ${graceCutoffSql}
      AND EXISTS (
        SELECT 1 FROM "MessageTemplate" mt
        WHERE mt.id = ${col("templateId")}
          AND mt."includePersonalizedPdf" = true
      )
    )`;
}

function buildRetryableCodeList() {
  return RETRYABLE_ERROR_CODES.map((code) => Prisma.sql`${code}`);
}

/**
 * Lists active organizations that currently have claimable queue work,
 * ordered deterministically by organization id.
 */
export async function listOrganizationsWithClaimableWork(
  options: {
    now?: Date;
    scheduledOnOrBefore?: Date;
    limit?: number;
  } = {},
): Promise<string[]> {
  const now = options.now ?? new Date();
  const nowSql = utcTimestampSql(now);
  const scheduledOnOrBefore =
    options.scheduledOnOrBefore ??
    parseTargetDate(
      getOrganizationLocalIsoDate(USAGE_PERIOD_TIMEZONE, now),
    ).date;
  const scheduledSql = utcTimestampSql(scheduledOnOrBefore);
  const limit = options.limit ?? 1000;
  const retryableCodes = buildRetryableCodeList();

  const rows = await prisma.$queryRaw<Array<{ organizationId: string }>>`
    SELECT DISTINCT sq."organizationId"
    FROM "SendQueue" sq
    INNER JOIN "Organization" o ON o.id = sq."organizationId"
    WHERE o."isActive" = true
      AND (
        (
          sq.status = CAST(${QueueStatus.PENDING} AS "QueueStatus")
          AND sq."scheduledDate" <= ${scheduledSql}
          AND (sq."nextAttemptAt" IS NULL OR sq."nextAttemptAt" <= ${nowSql})
          ${notAwaitingDocumentSql("sq", now)}
        )
        OR (
          sq.status = CAST(${QueueStatus.FAILED} AS "QueueStatus")
          AND sq."attemptCount" < ${MAX_SEND_ATTEMPTS}
          AND (sq."nextAttemptAt" IS NULL OR sq."nextAttemptAt" <= ${nowSql})
          AND (
            sq."lastErrorCode" IS NULL
            OR sq."lastErrorCode" IN (${Prisma.join(retryableCodes)})
          )
        )
      )
    ORDER BY sq."organizationId" ASC
    LIMIT ${limit}
  `;

  return rows.map((row) => row.organizationId);
}

/**
 * Atomically claims up to WORKER_CLAIM_BATCH_SIZE_PER_TENANT eligible rows for
 * one organization using FOR UPDATE SKIP LOCKED. No provider I/O.
 */
export async function claimQueueItemsForOrganization(
  organizationId: string,
  options: {
    now?: Date;
    scheduledOnOrBefore?: Date;
    limit?: number;
    leaseDurationMs?: number;
  } = {},
): Promise<ClaimedQueueRow[]> {
  const now = options.now ?? new Date();
  const nowSql = utcTimestampSql(now);
  const scheduledOnOrBefore =
    options.scheduledOnOrBefore ??
    parseTargetDate(
      getOrganizationLocalIsoDate(USAGE_PERIOD_TIMEZONE, now),
    ).date;
  const scheduledSql = utcTimestampSql(scheduledOnOrBefore);
  const limit = Math.min(
    options.limit ?? WORKER_CLAIM_BATCH_SIZE_PER_TENANT,
    WORKER_CLAIM_BATCH_SIZE_PER_TENANT,
  );
  const leaseExpiresAt = new Date(
    now.getTime() + (options.leaseDurationMs ?? QUEUE_LEASE_DURATION_MS),
  );
  const leaseSql = utcTimestampSql(leaseExpiresAt);
  const retryableCodes = buildRetryableCodeList();

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.findFirst({
      where: { id: organizationId, isActive: true },
      select: { id: true },
    });

    if (!org) {
      return [];
    }

    const claimed = await tx.$queryRaw<ClaimedQueueRow[]>`
      UPDATE "SendQueue" AS sq
      SET
        status = CAST(${QueueStatus.SENDING} AS "QueueStatus"),
        "claimedAt" = ${nowSql},
        "leaseExpiresAt" = ${leaseSql},
        "providerAttemptStartedAt" = NULL,
        "nextAttemptAt" = NULL,
        "updatedAt" = ${nowSql}
      WHERE sq.id IN (
        SELECT cand.id
        FROM "SendQueue" cand
        WHERE cand."organizationId" = ${organizationId}
          AND (
            (
              cand.status = CAST(${QueueStatus.PENDING} AS "QueueStatus")
              AND cand."scheduledDate" <= ${scheduledSql}
              AND (cand."nextAttemptAt" IS NULL OR cand."nextAttemptAt" <= ${nowSql})
              ${notAwaitingDocumentSql("cand", now)}
            )
            OR (
              cand.status = CAST(${QueueStatus.FAILED} AS "QueueStatus")
              AND cand."attemptCount" < ${MAX_SEND_ATTEMPTS}
              AND (cand."nextAttemptAt" IS NULL OR cand."nextAttemptAt" <= ${nowSql})
              AND (
                cand."lastErrorCode" IS NULL
                OR cand."lastErrorCode" IN (${Prisma.join(retryableCodes)})
              )
            )
          )
        ORDER BY cand."createdAt" ASC, cand.id ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING sq.id, sq."organizationId"
    `;

    return claimed;
  });
}

export { AMBIGUOUS_PROVIDER_OUTCOME };
