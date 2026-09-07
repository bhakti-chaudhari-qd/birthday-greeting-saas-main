import { describe, expect, it, vi } from "vitest";

import { lockAndCheckPrincipalEmail } from "@/lib/auth/principal-email";

function principalDb(results: {
  user?: object | null;
  platformAdmin?: object | null;
  vendorUser?: object | null;
}) {
  const queryRaw = vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]);
  const userFindFirst = vi.fn().mockResolvedValue(results.user ?? null);
  const adminFindFirst = vi
    .fn()
    .mockResolvedValue(results.platformAdmin ?? null);
  const vendorFindFirst = vi
    .fn()
    .mockResolvedValue(results.vendorUser ?? null);

  return {
    db: {
      $queryRaw: queryRaw,
      user: { findFirst: userFindFirst },
      platformAdmin: { findFirst: adminFindFirst },
      vendorUser: { findFirst: vendorFindFirst },
    },
    queryRaw,
    finders: [userFindFirst, adminFindFirst, vendorFindFirst],
  };
}

describe("principal email advisory lock", () => {
  it("locks the normalized email before checking every principal table", async () => {
    const { db, queryRaw, finders } = principalDb({});

    await expect(
      lockAndCheckPrincipalEmail(db as never, " Owner@Example.TEST "),
    ).resolves.toEqual({
      normalizedEmail: "owner@example.test",
      available: true,
    });

    for (const finder of finders) {
      expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        finder.mock.invocationCallOrder[0],
      );
      expect(finder).toHaveBeenCalledWith({
        where: {
          email: { equals: "owner@example.test", mode: "insensitive" },
        },
        select: { id: true },
      });
    }
  });

  it("reports a collision from any principal table while holding the lock", async () => {
    const { db } = principalDb({ vendorUser: { id: "vendor-user-1" } });

    await expect(
      lockAndCheckPrincipalEmail(db as never, "owner@example.test"),
    ).resolves.toMatchObject({ available: false });
  });
});
