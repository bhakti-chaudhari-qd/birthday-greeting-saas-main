import { beforeEach, describe, expect, it, vi } from "vitest";

type Bucket = {
  bucketKey: string;
  hitCount: number;
  windowStart: Date;
  lockedUntil: Date | null;
};

const state = new Map<string, Bucket>();
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn(),
}));

const tx = {
  authRateLimit: {
    upsert: mocks.upsert,
    updateMany: mocks.updateMany,
  },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

import {
  RateLimitError,
  consumeVendorRegistrationAttempt,
  vendorRegistrationThrottleKeys,
} from "@/lib/auth/rate-limit";

const now = new Date("2026-07-21T08:00:00.000Z");

describe("vendor registration rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.clear();

    mocks.upsert.mockImplementation(async ({ where, create }) => {
      if (!state.has(where.bucketKey)) {
        state.set(where.bucketKey, {
          ...create,
          lockedUntil: null,
        });
      }
      return state.get(where.bucketKey);
    });

    mocks.updateMany.mockImplementation(async ({ where, data }) => {
      const bucket = state.get(where.bucketKey);
      if (!bucket) return { count: 0 };

      if (data.hitCount?.increment) {
        if (
          bucket.windowStart < where.windowStart.gte ||
          bucket.hitCount >= where.hitCount.lt
        ) {
          return { count: 0 };
        }
        bucket.hitCount += data.hitCount.increment;
        return { count: 1 };
      }

      if (bucket.windowStart < where.windowStart.lt) {
        bucket.hitCount = data.hitCount;
        bucket.windowStart = data.windowStart;
        bucket.lockedUntil = data.lockedUntil;
        return { count: 1 };
      }
      return { count: 0 };
    });

    mocks.transaction.mockImplementation(
      async (operation: (client: typeof tx) => unknown) => {
        const snapshot = structuredClone(state);
        try {
          return await operation(tx);
        } catch (error) {
          state.clear();
          snapshot.forEach((value, key) => state.set(key, value));
          throw error;
        }
      },
    );
  });

  it("persists atomic IP and token-hash counters without raw IP keys", async () => {
    const ip = "203.0.113.10";
    const tokenHash = "a".repeat(64);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await consumeVendorRegistrationAttempt(ip, tokenHash, now);
    }

    await expect(
      consumeVendorRegistrationAttempt(ip, tokenHash, now),
    ).rejects.toBeInstanceOf(RateLimitError);

    const keys = vendorRegistrationThrottleKeys(ip, tokenHash);
    expect(keys.ipKey).not.toContain(ip);
    expect(keys.tokenKey).toContain(tokenHash);
    expect(state.get(keys.ipKey)?.hitCount).toBe(5);
    expect(state.get(keys.tokenKey)?.hitCount).toBe(5);
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          hitCount: { lt: 5 },
        }),
        data: { hitCount: { increment: 1 } },
      }),
    );
  });

  it("enforces the token bucket even when every forwarded IP changes", async () => {
    const tokenHash = "b".repeat(64);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await consumeVendorRegistrationAttempt(
        `spoofed-${attempt}.example`,
        tokenHash,
        now,
      );
    }

    await expect(
      consumeVendorRegistrationAttempt("spoofed-next.example", tokenHash, now),
    ).rejects.toBeInstanceOf(RateLimitError);
    expect(
      state.get(vendorRegistrationThrottleKeys("ignored", tokenHash).tokenKey)
        ?.hitCount,
    ).toBe(5);
  });
});
