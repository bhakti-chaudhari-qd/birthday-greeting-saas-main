import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getEffectiveMonthlyMessageLimit } from "@/lib/queue/limits";

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
  const existing = await prisma.authRateLimit.findUnique({
    where: { bucketKey },
  });

  if (!existing) {
    try {
      await prisma.authRateLimit.create({
        data: {
          bucketKey,
          hitCount: 1,
          windowStart: now,
        },
      });
      return;
    } catch (error) {
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
      ) {
        throw error;
      }
      // Concurrent first-hit race - fall through to update path.
    }
  }

  const current = await prisma.authRateLimit.findUnique({
    where: { bucketKey },
  });
  if (!current) {
    throw new SendVelocityError(overLimitMessage);
  }

  const age = now.getTime() - current.windowStart.getTime();
  if (age > windowMs) {
    await prisma.authRateLimit.update({
      where: { bucketKey },
      data: {
        hitCount: 1,
        windowStart: now,
        lockedUntil: null,
      },
    });
    return;
  }

  if (current.hitCount >= maxHits) {
    throw new SendVelocityError(overLimitMessage);
  }

  await prisma.authRateLimit.update({
    where: { bucketKey },
    data: { hitCount: current.hitCount + 1 },
  });
}

function resolvePlatformVelocityCeilings() {
  const configuredMinute = Number.parseInt(
    process.env.SEND_VELOCITY_PER_MINUTE ?? "60",
    10,
  );
  const configuredDay = Number.parseInt(
    process.env.SEND_VELOCITY_PER_DAY ?? "5000",
    10,
  );

  return {
    perMinute:
      Number.isFinite(configuredMinute) && configuredMinute > 0
        ? configuredMinute
        : 60,
    perDay:
      Number.isFinite(configuredDay) && configuredDay > 0 ? configuredDay : 5000,
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
  const subscriptionPerMinute = Math.max(
    60,
    Math.ceil(monthlyMessageLimit / 1440),
  );
  const subscriptionPerDay = monthlyMessageLimit;

  // Env vars are the platform ceiling (raise in prod for large tenants).
  // Effective monthly capacity (plan + bonus) sets the tenant's own cap beneath that.
  return {
    perMinute: Math.min(ceilings.perMinute, subscriptionPerMinute),
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
