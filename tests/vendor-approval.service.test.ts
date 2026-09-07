import { VendorOnboardingStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  vendorUpdate: vi.fn(),
  sessionDeleteMany: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  transaction: vi.fn(),
  deliveryFindMany: vi.fn(),
  createAuditEvent: vi.fn(),
}));

const tx = {
  vendor: {
    updateMany: mocks.updateMany,
    update: mocks.vendorUpdate,
    findUnique: mocks.findUnique,
  },
  vendorSession: { deleteMany: mocks.sessionDeleteMany },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: {
      findMany: mocks.findMany,
    },
    deliveryLog: {
      findMany: mocks.deliveryFindMany,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/admin/audit", () => ({
  PLATFORM_ADMIN_AUDIT_ACTIONS: {
    VENDOR_APPROVED: "VENDOR_APPROVED",
    VENDOR_REJECTED: "VENDOR_REJECTED",
    VENDOR_UPDATED: "VENDOR_UPDATED",
  },
  createPlatformAdminAuditEvent: mocks.createAuditEvent,
}));

import {
  PlatformAdminVendorError,
  approveVendorForPlatformAdmin,
  rejectVendorForPlatformAdmin,
  updateVendorForPlatformAdmin,
} from "@/lib/admin/vendors";

function listedVendor(onboardingStatus: VendorOnboardingStatus) {
  return {
    id: "vendor-1",
    name: "Acme",
    slug: "acme",
    mobile: "9876543210",
    referralCode: "ACME",
    onboardingStatus,
    isActive: true,
    createdAt: new Date("2026-07-21T08:00:00.000Z"),
    channelConfigs: [],
    _count: { users: 1, referredOrganizations: 0 },
  };
}

describe("vendor approval transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T08:00:00.000Z"));
    mocks.transaction.mockImplementation(
      (operation: (client: typeof tx) => unknown) => operation(tx),
    );
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.vendorUpdate.mockResolvedValue({ id: "vendor-1" });
    mocks.sessionDeleteMany.mockResolvedValue({ count: 2 });
    mocks.findMany.mockResolvedValue([
      listedVendor(VendorOnboardingStatus.APPROVED),
    ]);
    mocks.deliveryFindMany.mockResolvedValue([]);
  });

  it("atomically approves only a pending vendor and records the admin", async () => {
    await approveVendorForPlatformAdmin("vendor-1", "admin-1");

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "vendor-1",
        onboardingStatus: VendorOnboardingStatus.PENDING,
      },
      data: {
        onboardingStatus: VendorOnboardingStatus.APPROVED,
        approvedAt: new Date("2026-07-21T08:00:00.000Z"),
        approvedByAdminId: "admin-1",
      },
    });
    expect(mocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAdminId: "admin-1",
        action: "VENDOR_APPROVED",
        before: { status: "PENDING" },
        after: { status: "APPROVED" },
      }),
      tx,
    );
  });

  it("rejects pending vendors and clears stale approval fields", async () => {
    mocks.findMany.mockResolvedValue([
      listedVendor(VendorOnboardingStatus.REJECTED),
    ]);

    await rejectVendorForPlatformAdmin("vendor-1", "admin-1");

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "vendor-1",
        onboardingStatus: VendorOnboardingStatus.PENDING,
      },
      data: {
        onboardingStatus: VendorOnboardingStatus.REJECTED,
        approvedAt: null,
        approvedByAdminId: null,
      },
    });
    expect(mocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAdminId: "admin-1",
        action: "VENDOR_REJECTED",
      }),
      tx,
    );
  });

  it("reports a conflict when another transition wins the race", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    mocks.findUnique.mockResolvedValue({ id: "vendor-1" });

    await expect(
      approveVendorForPlatformAdmin("vendor-1", "admin-1"),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    } satisfies Partial<PlatformAdminVendorError>);
  });

  it("prevents generic updates from activating an unapproved vendor", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "vendor-1",
      name: "Acme",
      referralCode: "ACME",
      isActive: false,
      onboardingStatus: VendorOnboardingStatus.PENDING,
    });

    await expect(
      updateVendorForPlatformAdmin(
        "vendor-1",
        { isActive: true },
        "admin-1",
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION",
    } satisfies Partial<PlatformAdminVendorError>);
  });

  it("revokes every vendor session when an approved vendor is suspended", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "vendor-1",
      name: "Acme",
      referralCode: "ACME",
      isActive: true,
      onboardingStatus: VendorOnboardingStatus.APPROVED,
    });
    mocks.findMany.mockResolvedValue([
      { ...listedVendor(VendorOnboardingStatus.APPROVED), isActive: false },
    ]);

    await updateVendorForPlatformAdmin(
      "vendor-1",
      { isActive: false },
      "admin-1",
    );

    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({
      where: { vendorId: "vendor-1" },
    });
    expect(mocks.sessionDeleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createAuditEvent.mock.invocationCallOrder[0],
    );
  });
});
