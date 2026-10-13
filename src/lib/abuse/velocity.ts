import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db";
import { getEffectiveMonthlyMessageLimit } from "@/lib/queue/limits";
import { utcTimestampSql } from "@/lib/queue/sql-time";

export class SendVelocityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SendVelocityError";
  }
}

export const SEND_VELOCITY_LIMIT_CODE = "SEND_VELOCITY_LIMIT" as const;

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Buffer past the minute window so retries land after the bucket resets. */
const VELOCITY_RETRY_BUFFER_MS = 2_000;
const VELOCITY_RETRY_MIN_MS = 5_000;

function minuteKey(organizationId: string): string {
  return `send:org:${organizationId}:minute`;
}

function dayKey(organizationId: string): string {
  return `send:org:${organizationId}:day`;
}

function bucketUsage(
  bucket: { hitCount: number; windowStart: Date } | null,
  windowMs: number,
  now: Date,
): { used: number; retryAfterMs: number } {
  if (!bucket) {
    return { used: 0, retryAfterMs: windowMs };
  }

  const age = now.getTime() - bucket.windowStart.getTime();
  if (age > windowMs) {
    return { used: 0, retryAfterMs: windowMs };
  }

  return {
    used: bucket.hitCount,
    retryAfterMs: Math.max(
      VELOCITY_RETRY_MIN_MS,
      windowMs - age + VELOCITY_RETRY_BUFFER_MS,
    ),
  };
}

async function bumpBucket(
  bucketKey: string,
  windowMs: number,
  maxHits: number,
  overLimitMessage: string,
): Promise<void> {
  const now = new Date();
  const nowSql = utcTimestampSql(now);
  const windowCutoffSql = utcTimestampSql(new Date(now.getTime() - windowMs));

  // One atomic statement: concurrent sends each take a row lock in turn, so
  // no hit is lost and the limit cannot be overshot. No row back = over limit.
  const bumped = await prisma.$queryRaw<Array<{ hitCount: number }>>`
    INSERT INTO "AuthRateLimit" AS rl
      ("id", "bucketKey", "hitCount", "windowStart", "updatedAt")
    VALUES (${randomUUID()}, ${bucketKey}, 1, ${nowSql}, ${nowSql})
    ON CONFLICT ("bucketKey") DO UPDATE SET
      "hitCount" = CASE
        WHEN rl."windowStart" < ${windowCutoffSql} THEN 1
        ELSE rl."hitCount" + 1
      END,
      "windowStart" = CASE
        WHEN rl."windowStart" < ${windowCutoffSql} THEN ${nowSql}
        ELSE rl."windowStart"
      END,
      "lockedUntil" = CASE
        WHEN rl."windowStart" < ${windowCutoffSql} THEN NULL
        ELSE rl."lockedUntil"
      END,
      "updatedAt" = ${nowSql}
    WHERE rl."windowStart" < ${windowCutoffSql}
      OR rl."hitCount" < ${maxHits}
    RETURNING rl."hitCount"
  `;

  if (bumped.length === 0) {
    throw new SendVelocityError(overLimitMessage);
  }
}

function resolvePlatformVelocityCeilings() {
  const configuredMinute = Number.parseInt(
    process.env.SEND_VELOCITY_PER_MINUTE ?? "60",
    10,
  );
  const configuredDay = Number.parseInt(
    process.env.SEND_VELOCITY_PER_DAY ?? "10000",
    10,
  );

  return {
    perMinute:
      Number.isFinite(configuredMinute) && configuredMinute > 0
        ? configuredMinute
        : 60,
    perDay:
      Number.isFinite(configuredDay) && configuredDay > 0 ? configuredDay : 10000,
  };
}

async function resolveOrganizationVelocityLimits(organizationId: string) {
  const ceilings = resolvePlatformVelocityCeilings();
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { monthlyMessageLimit: true, bonusMessageCredits: true },
  });

  const monthlyMessageLimit = subscription
    ? getEffectiveMonthlyMessageLimit(subscription)
    : 500;
  const subscriptionPerDay = monthlyMessageLimit;

  // Per minute is pure pacing, the same for every tenant: SEND_VELOCITY_PER_MINUTE.
  // Per day is the platform ceiling with the tenant's effective monthly
  // capacity (plan + bonus) as its own cap beneath that.
  return {
    perMinute: ceilings.perMinute,
    perDay: Math.min(ceilings.perDay, subscriptionPerDay),
  };
}

export type OrganizationSendVelocityBudget = {
  perMinute: number;
  perDay: number;
  remainingMinute: number;
  remainingDay: number;
  /** How many sends this org can still take right now. */
  remaining: number;
  /** Suggested wait before retrying when remaining is 0. */
  retryAfterMs: number;
};

/**
 * Read-only velocity budget for worker pacing (does not consume quota).
 */
export async function getOrganizationSendVelocityBudget(
  organizationId: string,
  now: Date = new Date(),
): Promise<OrganizationSendVelocityBudget> {
  const { perMinute, perDay } =
    await resolveOrganizationVelocityLimits(organizationId);

  const [minuteBucket, dayBucket] = await Promise.all([
    prisma.authRateLimit.findUnique({
      where: { bucketKey: minuteKey(organizationId) },
      select: { hitCount: true, windowStart: true },
    }),
    prisma.authRateLimit.findUnique({
      where: { bucketKey: dayKey(organizationId) },
      select: { hitCount: true, windowStart: true },
    }),
  ]);

  const minute = bucketUsage(minuteBucket, MINUTE_MS, now);
  const day = bucketUsage(dayBucket, DAY_MS, now);
  const remainingMinute = Math.max(0, perMinute - minute.used);
  const remainingDay = Math.max(0, perDay - day.used);
  const remaining = Math.min(remainingMinute, remainingDay);

  return {
    perMinute,
    perDay,
    remainingMinute,
    remainingDay,
    remaining,
    retryAfterMs:
      remainingMinute === 0
        ? minute.retryAfterMs
        : remainingDay === 0
          ? day.retryAfterMs
          : Math.min(minute.retryAfterMs, day.retryAfterMs),
  };
}

/**
 * Per-org send velocity so one tenant cannot starve the worker.
 * Limits scale with subscription monthlyMessageLimit up to platform env ceilings.
 */
export async function assertAndRecordSendVelocity(
  organizationId: string,
): Promise<void> {
  const { perMinute, perDay } =
    await resolveOrganizationVelocityLimits(organizationId);

  await bumpBucket(
    minuteKey(organizationId),
    MINUTE_MS,
    perMinute,
    `Send rate limit exceeded for this organization (max ${perMinute} per minute). Try again shortly.`,
  );

  await bumpBucket(
    dayKey(organizationId),
    DAY_MS,
    perDay,
    `Send rate limit exceeded for this organization (max ${perDay} per day). Try again tomorrow.`,
  );
}
