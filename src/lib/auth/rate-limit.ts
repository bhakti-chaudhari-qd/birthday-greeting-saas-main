import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export class RateLimitError extends Error {
  constructor(message = "Too many attempts. Try again later.") {
    super(message);
    this.name = "RateLimitError";
  }
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_MAX_PER_WINDOW = 3;

const ADMIN_PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;
const ADMIN_PASSWORD_RESET_MAX_PER_WINDOW = 3;

const VENDOR_REGISTER_WINDOW_MS = 60 * 60 * 1000;
const VENDOR_REGISTER_MAX_PER_IP = 10;
const VENDOR_REGISTER_MAX_PER_TOKEN = 5;

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first.slice(0, 128);
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp.slice(0, 128);
  }

  return "unknown";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function loginThrottleKey(portal: string, ip: string, email: string): string {
  return `login:${portal}:${ip}:${normalizeEmail(email)}`;
}

export function registerThrottleKey(ip: string): string {
  return `register:ip:${ip}`;
}

export function adminPasswordResetThrottleKey(
  adminId: string,
  targetUserId: string,
): string {
  return `admin-password-reset:${adminId}:${targetUserId}`;
}

async function getOrCreateBucket(bucketKey: string, windowMs: number) {
  const now = new Date();
  const existing = await prisma.authRateLimit.findUnique({
    where: { bucketKey },
  });

  if (!existing) {
    return prisma.authRateLimit.create({
      data: {
        bucketKey,
        hitCount: 0,
        windowStart: now,
      },
    });
  }

  if (existing.lockedUntil && existing.lockedUntil > now) {
    throw new RateLimitError();
  }

  const windowAge = now.getTime() - existing.windowStart.getTime();
  if (windowAge > windowMs) {
    return prisma.authRateLimit.update({
      where: { bucketKey },
      data: {
        hitCount: 0,
        windowStart: now,
        lockedUntil: null,
      },
    });
  }

  return existing;
}

/** Throws RateLimitError if the login bucket is locked or over limit. */
export async function assertLoginAllowed(bucketKey: string): Promise<void> {
  await getOrCreateBucket(bucketKey, LOGIN_WINDOW_MS);
  const row = await prisma.authRateLimit.findUnique({ where: { bucketKey } });
  if (!row) {
    return;
  }

  const now = new Date();
  if (row.lockedUntil && row.lockedUntil > now) {
    throw new RateLimitError();
  }

  if (row.hitCount >= LOGIN_MAX_FAILURES) {
    await prisma.authRateLimit.update({
      where: { bucketKey },
      data: { lockedUntil: new Date(now.getTime() + LOGIN_LOCKOUT_MS) },
    });
    throw new RateLimitError();
  }
}

export async function recordLoginFailure(bucketKey: string): Promise<void> {
  const row = await getOrCreateBucket(bucketKey, LOGIN_WINDOW_MS);
  const nextCount = row.hitCount + 1;
  const now = new Date();

  await prisma.authRateLimit.update({
    where: { bucketKey },
    data: {
      hitCount: nextCount,
      lockedUntil:
        nextCount >= LOGIN_MAX_FAILURES
          ? new Date(now.getTime() + LOGIN_LOCKOUT_MS)
          : row.lockedUntil,
    },
  });
}

export async function clearLoginFailures(bucketKey: string): Promise<void> {
  await prisma.authRateLimit.deleteMany({ where: { bucketKey } });
}

export async function assertRegistrationAllowed(bucketKey: string): Promise<void> {
  const row = await getOrCreateBucket(bucketKey, REGISTER_WINDOW_MS);
  if (row.hitCount >= REGISTER_MAX_PER_WINDOW) {
    throw new RateLimitError("Too many registrations from this network. Try again later.");
  }
}

export async function recordRegistration(bucketKey: string): Promise<void> {
  const row = await getOrCreateBucket(bucketKey, REGISTER_WINDOW_MS);
  await prisma.authRateLimit.update({
    where: { bucketKey },
    data: { hitCount: row.hitCount + 1 },
  });
}

export async function recordAdminPasswordReset(
  bucketKey: string,
): Promise<void> {
  const now = new Date();
  const windowCutoff = new Date(
    now.getTime() - ADMIN_PASSWORD_RESET_WINDOW_MS,
  );

  await prisma.authRateLimit.upsert({
    where: { bucketKey },
    create: {
      bucketKey,
      hitCount: 0,
      windowStart: now,
    },
    update: {},
  });

  await prisma.authRateLimit.updateMany({
    where: {
      bucketKey,
      windowStart: { lt: windowCutoff },
    },
    data: {
      hitCount: 0,
      windowStart: now,
      lockedUntil: null,
    },
  });

  const claimed = await prisma.authRateLimit.updateMany({
    where: {
      bucketKey,
      windowStart: { gte: windowCutoff },
      hitCount: { lt: ADMIN_PASSWORD_RESET_MAX_PER_WINDOW },
    },
    data: { hitCount: { increment: 1 } },
  });

  if (claimed.count !== 1) {
    throw new RateLimitError(
      "Too many password reset emails for this user. Try again later.",
    );
  }
}

function hashRateLimitSubject(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function vendorRegistrationThrottleKeys(
  ip: string,
  tokenHash: string,
): { ipKey: string; tokenKey: string } {
  return {
    ipKey: `vendor-register:ip:${hashRateLimitSubject(ip)}`,
    tokenKey: `vendor-register:token:${tokenHash}`,
  };
}

async function consumeAtomicWindow(
  tx: Prisma.TransactionClient,
  bucketKey: string,
  maximum: number,
  now: Date,
): Promise<void> {
  const windowCutoff = new Date(now.getTime() - VENDOR_REGISTER_WINDOW_MS);

  await tx.authRateLimit.upsert({
    where: { bucketKey },
    create: {
      bucketKey,
      hitCount: 0,
      windowStart: now,
    },
    update: {},
  });

  await tx.authRateLimit.updateMany({
    where: {
      bucketKey,
      windowStart: { lt: windowCutoff },
    },
    data: {
      hitCount: 0,
      windowStart: now,
      lockedUntil: null,
    },
  });

  const claimed = await tx.authRateLimit.updateMany({
    where: {
      bucketKey,
      windowStart: { gte: windowCutoff },
      hitCount: { lt: maximum },
    },
    data: { hitCount: { increment: 1 } },
  });

  if (claimed.count !== 1) {
    throw new RateLimitError(
      "Too many vendor registration attempts. Try again later.",
    );
  }
}

/**
 * Persist and atomically claim both vendor-registration rate-limit buckets.
 * A failure on either bucket rolls back the other bucket's increment.
 */
export async function consumeVendorRegistrationAttempt(
  ip: string,
  tokenHash: string,
  now = new Date(),
): Promise<void> {
  const keys = vendorRegistrationThrottleKeys(ip, tokenHash);

  await prisma.$transaction(async (tx) => {
    await consumeAtomicWindow(
      tx,
      keys.ipKey,
      VENDOR_REGISTER_MAX_PER_IP,
      now,
    );
    await consumeAtomicWindow(
      tx,
      keys.tokenKey,
      VENDOR_REGISTER_MAX_PER_TOKEN,
      now,
    );
  });
}
