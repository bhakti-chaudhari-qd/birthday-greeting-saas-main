import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Bucket = {
  bucketKey: string;
  hitCount: number;
  windowStart: Date;
  lockedUntil: Date | null;
};

type LockedFilter = { lockedUntil: null | { lte: Date } };

type Where = {
  bucketKey: string | { in: string[] };
  windowStart?: { lt: Date };
  hitCount?: { lt?: number; gte?: number };
  lockedUntil?: null;
  OR?: LockedFilter[];
};

const state = new Map<string, Bucket>();
const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    authRateLimit: {
      upsert: mocks.upsert,
      updateMany: mocks.updateMany,
      deleteMany: mocks.deleteMany,
    },
  },
}));

import {
  RateLimitError,
  clearLoginAttempts,
  consumeLoginAttempt,
  consumeThrottledAttempt,
  getClientIp,
  loginThrottleKeys,
} from "@/lib/auth/rate-limit";

function matches(bucket: Bucket, where: Where): boolean {
  if (where.windowStart && !(bucket.windowStart < where.windowStart.lt)) {
    return false;
  }
  if (where.hitCount?.lt !== undefined && !(bucket.hitCount < where.hitCount.lt)) {
    return false;
  }
  if (where.hitCount?.gte !== undefined && !(bucket.hitCount >= where.hitCount.gte)) {
    return false;
  }
  if (where.lockedUntil === null && bucket.lockedUntil !== null) {
    return false;
  }
  if (where.OR) {
    const unlocked = where.OR.some((filter) =>
      filter.lockedUntil === null
        ? bucket.lockedUntil === null
        : bucket.lockedUntil !== null &&
          bucket.lockedUntil <= filter.lockedUntil.lte,
    );
    if (!unlocked) {
      return false;
    }
  }
  return true;
}

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request("https://app.example/api/auth/login", { headers });
}

const start = new Date("2026-07-21T08:00:00.000Z");
const MINUTE_MS = 60 * 1000;

describe("login rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(start);
    state.clear();

    mocks.upsert.mockImplementation(async ({ where, create }) => {
      if (!state.has(where.bucketKey)) {
        state.set(where.bucketKey, { ...create, lockedUntil: null });
      }
      return state.get(where.bucketKey);
    });

    mocks.updateMany.mockImplementation(
      async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        const bucket = state.get(where.bucketKey as string);
        if (!bucket || !matches(bucket, where)) {
          return { count: 0 };
        }

        const hitCount = data.hitCount as number | { increment: number } | undefined;
        if (typeof hitCount === "number") {
          bucket.hitCount = hitCount;
        } else if (hitCount) {
          bucket.hitCount += hitCount.increment;
        }
        if ("windowStart" in data) {
          bucket.windowStart = data.windowStart as Date;
        }
        if ("lockedUntil" in data) {
          bucket.lockedUntil = data.lockedUntil as Date | null;
        }
        return { count: 1 };
      },
    );

    mocks.deleteMany.mockImplementation(async ({ where }: { where: Where }) => {
      const keys =
        typeof where.bucketKey === "string"
          ? [where.bucketKey]
          : where.bucketKey.in;
      let count = 0;
      for (const key of keys) {
        if (state.delete(key)) count += 1;
      }
      return { count };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.TRUSTED_PROXY_HOPS;
  });

  it("reads the address the proxy appended, not one the caller sent", () => {
    expect(
      getClientIp(
        requestWithHeaders({ "x-forwarded-for": "1.2.3.4, 203.0.113.10" }),
      ),
    ).toBe("203.0.113.10");
    expect(
      getClientIp(requestWithHeaders({ "x-forwarded-for": "203.0.113.10" })),
    ).toBe("203.0.113.10");
  });

  it("counts back by the configured number of trusted proxies", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";

    expect(
      getClientIp(
        requestWithHeaders({
          "x-forwarded-for": "1.2.3.4, 203.0.113.10, 198.51.100.7",
        }),
      ),
    ).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip, then unknown", () => {
    expect(getClientIp(requestWithHeaders({ "x-real-ip": "203.0.113.10" }))).toBe(
      "203.0.113.10",
    );
    expect(getClientIp(requestWithHeaders({}))).toBe("unknown");
  });

  it("shares one account bucket across identifier spellings", () => {
    expect(loginThrottleKeys("unified", "203.0.113.10", " Owner@Acme.Test ")).toEqual({
      ipKey: "login:unified:203.0.113.10:owner@acme.test",
      accountKey: "login:unified:account:owner@acme.test",
    });
    expect(
      loginThrottleKeys("unified", "203.0.113.10", "+91 98765 43210").accountKey,
    ).toBe(loginThrottleKeys("unified", "203.0.113.11", "09876543210").accountKey);
  });

  it("locks an address after five attempts and releases it after the lockout", async () => {
    const keys = loginThrottleKeys("unified", "203.0.113.10", "owner@acme.test");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await consumeLoginAttempt(keys);
    }
    await expect(consumeLoginAttempt(keys)).rejects.toBeInstanceOf(RateLimitError);

    vi.setSystemTime(new Date(start.getTime() + 14 * MINUTE_MS));
    await expect(consumeLoginAttempt(keys)).rejects.toBeInstanceOf(RateLimitError);

    vi.setSystemTime(new Date(start.getTime() + 16 * MINUTE_MS));
    await expect(consumeLoginAttempt(keys)).resolves.toBeUndefined();
  });

  it("locks the account when attempts are spread across addresses", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await consumeLoginAttempt(
        loginThrottleKeys("unified", `198.51.100.${attempt}`, "owner@acme.test"),
      );
    }

    await expect(
      consumeLoginAttempt(
        loginThrottleKeys("unified", "198.51.100.200", "owner@acme.test"),
      ),
    ).rejects.toBeInstanceOf(RateLimitError);

    await expect(
      consumeLoginAttempt(
        loginThrottleKeys("unified", "198.51.100.200", "other@acme.test"),
      ),
    ).resolves.toBeUndefined();
  });

  it("lets only the remaining attempts through when requests arrive together", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => consumeThrottledAttempt("burst", 5)),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
    expect(state.get("burst")?.hitCount).toBe(5);
  });

  it("clears both buckets after a successful sign-in", async () => {
    const keys = loginThrottleKeys("unified", "203.0.113.10", "owner@acme.test");

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await consumeLoginAttempt(keys);
    }
    await clearLoginAttempts(keys);

    expect(state.size).toBe(0);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await consumeLoginAttempt(keys);
    }
  });
});
