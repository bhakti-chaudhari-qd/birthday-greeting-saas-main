import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    authRateLimit: {
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
      upsert: mocks.upsert,
      updateMany: mocks.updateMany,
    },
  },
}));

import {
  RateLimitError,
  adminPasswordResetThrottleKey,
  recordAdminPasswordReset,
} from "@/lib/auth/rate-limit";

describe("platform admin password reset rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsert.mockReset().mockResolvedValue({});
    mocks.updateMany
      .mockReset()
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
  });

  it("keys the bucket by admin and target user", () => {
    expect(adminPasswordResetThrottleKey("admin-1", "user-1")).toBe(
      "admin-password-reset:admin-1:user-1",
    );
    expect(adminPasswordResetThrottleKey("admin-2", "user-1")).not.toBe(
      adminPasswordResetThrottleKey("admin-1", "user-1"),
    );
  });

  it("atomically claims one of the three reset slots", async () => {
    await recordAdminPasswordReset(
      "admin-password-reset:admin-1:user-1",
    );

    expect(mocks.updateMany).toHaveBeenLastCalledWith({
      where: {
        bucketKey: "admin-password-reset:admin-1:user-1",
        windowStart: { gte: expect.any(Date) },
        hitCount: { lt: 3 },
      },
      data: { hitCount: { increment: 1 } },
    });
  });

  it("rejects when the conditional increment cannot claim a slot", async () => {
    mocks.updateMany
      .mockReset()
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(
      recordAdminPasswordReset("admin-password-reset:admin-1:user-1"),
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});
