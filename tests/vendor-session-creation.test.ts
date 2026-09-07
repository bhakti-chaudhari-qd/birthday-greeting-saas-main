import { VendorOnboardingStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  vendorUserFindFirst: vi.fn(),
  vendorSessionCreate: vi.fn(),
  cookieSet: vi.fn(),
}));

const tx = {
  $queryRaw: mocks.queryRaw,
  vendorUser: { findFirst: mocks.vendorUserFindFirst },
  vendorSession: { create: mocks.vendorSessionCreate },
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: mocks.cookieSet })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

import {
  VendorSessionCreationError,
  createVendorSession,
} from "@/lib/auth/vendor-session";

function eligibleVendorUser(isActive = true) {
  return {
    id: "vendor-user-1",
    vendorId: "vendor-1",
    isActive: true,
    vendor: {
      isActive,
      onboardingStatus: VendorOnboardingStatus.APPROVED,
    },
  };
}

describe("vendor session creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      (operation: (client: typeof tx) => unknown) => operation(tx),
    );
    mocks.queryRaw.mockResolvedValue([{ id: "vendor-1" }]);
    mocks.vendorUserFindFirst.mockResolvedValue(eligibleVendorUser());
    mocks.vendorSessionCreate.mockResolvedValue({ id: "session-1" });
  });

  it("locks and revalidates the vendor before inserting the session", async () => {
    await createVendorSession("vendor-user-1", "vendor-1");

    expect(mocks.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.vendorUserFindFirst.mock.invocationCallOrder[0],
    );
    expect(mocks.vendorUserFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.vendorSessionCreate.mock.invocationCallOrder[0],
    );
    expect(mocks.vendorUserFindFirst).toHaveBeenCalledWith({
      where: { id: "vendor-user-1", vendorId: "vendor-1" },
      include: { vendor: true },
    });
    expect(mocks.cookieSet).toHaveBeenCalledTimes(1);
  });

  it("rejects session creation when suspension wins the vendor lock", async () => {
    mocks.vendorUserFindFirst.mockResolvedValueOnce(eligibleVendorUser(false));

    await expect(
      createVendorSession("vendor-user-1", "vendor-1"),
    ).rejects.toBeInstanceOf(VendorSessionCreationError);
    expect(mocks.vendorSessionCreate).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("rejects when the vendor disappears before the lock is acquired", async () => {
    mocks.queryRaw.mockResolvedValueOnce([]);

    await expect(
      createVendorSession("vendor-user-1", "vendor-1"),
    ).rejects.toBeInstanceOf(VendorSessionCreationError);
    expect(mocks.vendorUserFindFirst).not.toHaveBeenCalled();
  });
});
