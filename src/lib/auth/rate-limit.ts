import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { normalizeMobile } from "@/lib/contacts/mobile";
import { prisma } from "@/lib/db";

export class RateLimitError extends Error {
  constructor(message = "Too many attempts. Try again later.") {
    super(message);
    this.name = "RateLimitError";
  }
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
/** Per-account ceiling that holds whatever address the attempts come from. */
const LOGIN_ACCOUNT_MAX_FAILURES = 10;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_MAX_PER_WINDOW = 3;

const ADMIN_PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;
const ADMIN_PASSWORD_RESET_MAX_PER_WINDOW = 3;

const VENDOR_REGISTER_WINDOW_MS = 60 * 60 * 1000;
const VENDOR_REGISTER_MAX_PER_IP = 10;
const VENDOR_REGISTER_MAX_PER_TOKEN = 5;

/**
 * Number of trusted reverse proxies in front of the app (nginx = 1). Each one
 * appends the address it saw to X-Forwarded-For, so the client address is that
 * many entries from the right - anything further left was sent by the caller
 * and can be forged.
 */
function trustedProxyHops(): number {
  const parsed = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const entries = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const fromProxy = entries[entries.length - trustedProxyHops()] ?? entries[0];
    if (fromProxy) {
      return fromProxy.slice(0, 128);
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp.slice(0, 128);
  }

  return "unknown";
}

/** One spelling per account, so formatting variants share a bucket. */
function normalizeLoginIdentifier(identifier: string): string {
  const trimmed = identifier.trim().toLowerCase();
  if (trimmed.includes("@")) {
    return trimmed;
  }

  try {
    return normalizeMobile(trimmed);
  } catch {
    return trimmed;
  }
}

export type LoginThrottleKeys = {
  /** Attempts on this account from one address. */
  ipKey: string;
  /** Attempts on this account from anywhere. */
  accountKey: string;
};

export function loginThrottleKeys(
  portal: string,
  ip: string,
  identifier: string,
): LoginThrottleKeys {
  const account = normalizeLoginIdentifier(identifier);
  return {
    ipKey: `login:${portal}:${ip}:${account}`,
    accountKey: `login:${portal}:account:${account}`,
  };
}

export function registerThrottleKey(ip: string): string {
  return `register:ip:${ip}`;
}

/** No email available at this step (only a reset token) - throttle by IP alone. */
export function resetPasswordThrottleKey(ip: string): string {
  return `reset-password:ip:${ip}`;
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

/**
 * Atomically claims one attempt from a bucket, or throws RateLimitError. The
 * attempt is counted before the caller checks the password, so parallel
 * requests cannot all slip through ahead of the first recorded failure.
 * Reaching the limit locks the bucket for LOGIN_LOCKOUT_MS.
 */
export async function consumeThrottledAttempt(
  bucketKey: string,
  maxAttempts = LOGIN_MAX_FAILURES,
): Promise<void> {
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - LOGIN_WINDOW_MS);
  const notLocked = {
    OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
  };

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
      ...notLocked,
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
      hitCount: { lt: maxAttempts },
      ...notLocked,
    },
    data: { hitCount: { increment: 1 } },
  });

  if (claimed.count !== 1) {
    throw new RateLimitError();
  }

  await prisma.authRateLimit.updateMany({
    where: {
      bucketKey,
      hitCount: { gte: maxAttempts },
      lockedUntil: null,
    },
    data: { lockedUntil: new Date(now.getTime() + LOGIN_LOCKOUT_MS) },
  });
}

export async function clearThrottledAttempts(bucketKey: string): Promise<void> {
  await prisma.authRateLimit.deleteMany({ where: { bucketKey } });
}

/** Claims an attempt from both login buckets; call before checking credentials. */
export async function consumeLoginAttempt(
  keys: LoginThrottleKeys,
): Promise<void> {
  await consumeThrottledAttempt(keys.ipKey, LOGIN_MAX_FAILURES);
  await consumeThrottledAttempt(keys.accountKey, LOGIN_ACCOUNT_MAX_FAILURES);
}

/** Resets both login buckets after a successful sign-in. */
export async function clearLoginAttempts(
  keys: LoginThrottleKeys,
): Promise<void> {
  await prisma.authRateLimit.deleteMany({
    where: { bucketKey: { in: [keys.ipKey, keys.accountKey] } },
  });
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
