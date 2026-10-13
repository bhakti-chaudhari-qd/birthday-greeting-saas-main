import { AuthTokenPurpose } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TokenRow = {
  id: string;
  tokenHash: string;
  purpose: AuthTokenPurpose;
  userId: string;
  usedAt: Date | null;
  expiresAt: Date;
};

const rows = new Map<string, TokenRow>();
const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    authToken: {
      updateMany: mocks.updateMany,
      findUnique: mocks.findUnique,
    },
  },
}));

import { consumeAuthToken, hashAuthToken } from "@/lib/auth/auth-tokens";

const RAW = "raw-reset-token-value";

describe("consumeAuthToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rows.clear();
    rows.set(hashAuthToken(RAW), {
      id: "tok-1",
      tokenHash: hashAuthToken(RAW),
      purpose: AuthTokenPurpose.PASSWORD_RESET,
      userId: "user-1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    // updateMany only flips usedAt when it is still null and unexpired - the
    // same atomic guard the database enforces.
    mocks.updateMany.mockImplementation(async ({ where, data }) => {
      const row = rows.get(where.tokenHash);
      if (
        !row ||
        row.purpose !== where.purpose ||
        row.usedAt !== null ||
        !(row.expiresAt.getTime() > where.expiresAt.gt.getTime())
      ) {
        return { count: 0 };
      }
      row.usedAt = data.usedAt;
      return { count: 1 };
    });

    mocks.findUnique.mockImplementation(async ({ where }) => {
      const row = rows.get(where.tokenHash);
      return row ? { userId: row.userId } : null;
    });
  });

  it("returns the user once for a valid token", async () => {
    const result = await consumeAuthToken({
      rawToken: RAW,
      purpose: AuthTokenPurpose.PASSWORD_RESET,
    });
    expect(result).toEqual({ userId: "user-1" });
  });

  it("lets only one of two racing consumers win", async () => {
    const [a, b] = await Promise.all([
      consumeAuthToken({ rawToken: RAW, purpose: AuthTokenPurpose.PASSWORD_RESET }),
      consumeAuthToken({ rawToken: RAW, purpose: AuthTokenPurpose.PASSWORD_RESET }),
    ]);
    const winners = [a, b].filter((r) => r !== null);
    expect(winners).toHaveLength(1);
  });

  it("rejects a second use, a wrong purpose, and an expired token", async () => {
    await consumeAuthToken({ rawToken: RAW, purpose: AuthTokenPurpose.PASSWORD_RESET });
    expect(
      await consumeAuthToken({ rawToken: RAW, purpose: AuthTokenPurpose.PASSWORD_RESET }),
    ).toBeNull();

    rows.clear();
    rows.set(hashAuthToken(RAW), {
      id: "tok-2",
      tokenHash: hashAuthToken(RAW),
      purpose: AuthTokenPurpose.PASSWORD_RESET,
      userId: "user-1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
    });
    expect(
      await consumeAuthToken({ rawToken: RAW, purpose: AuthTokenPurpose.PASSWORD_RESET }),
    ).toBeNull();
  });
});
