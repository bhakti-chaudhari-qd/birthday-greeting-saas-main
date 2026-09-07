import {
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  updateUser: vi.fn(),
  findOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  createSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  findUsers: vi.fn(),
  getOrganizationSummary: vi.fn(),
  createAuditEvent: vi.fn(),
  transaction: vi.fn(),
}));

const tx = {
  user: {
    findFirst: mocks.findUser,
    update: mocks.updateUser,
  },
  organization: {
    findUnique: mocks.findOrganization,
    update: mocks.updateOrganization,
  },
  subscription: {
    create: mocks.createSubscription,
    update: mocks.updateSubscription,
  },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    user: {
      findMany: mocks.findUsers,
    },
  },
}));

vi.mock("@/lib/admin/audit", () => ({
  PLATFORM_ADMIN_AUDIT_ACTIONS: {
    ORGANIZATION_UPDATED: "ORGANIZATION_UPDATED",
    USER_ACTIVATED: "ORGANIZATION_USER_ACTIVATED",
    USER_DEACTIVATED: "ORGANIZATION_USER_DEACTIVATED",
  },
  createPlatformAdminAuditEvent: mocks.createAuditEvent,
}));

vi.mock("@/lib/admin/organizations", () => ({
  getOrganizationSummaryForPlatformAdmin: mocks.getOrganizationSummary,
  listOrganizationsForPlatformAdmin: vi.fn(),
}));

vi.mock("@/lib/auth/email-flows", () => ({
  sendPasswordResetForUser: vi.fn(),
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  adminPasswordResetThrottleKey: vi.fn(),
  recordAdminPasswordReset: vi.fn(),
}));

import {
  setOrganizationUserActiveForPlatformAdmin,
  updateOrganizationForPlatformAdmin,
} from "@/lib/admin/org-ops";

describe("Platform Admin mutation audit behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    mocks.findUsers.mockResolvedValue([]);
  });

  it("does not update or audit an unchanged user activation", async () => {
    mocks.findUser.mockResolvedValue({
      id: "user-1",
      name: "Existing User",
      email: "user@example.test",
      role: "STAFF",
      isActive: true,
      createdAt: new Date("2026-07-20T08:00:00.000Z"),
    });

    const result = await setOrganizationUserActiveForPlatformAdmin({
      actorAdminId: "admin-from-session",
      organizationId: "org-1",
      userId: "user-1",
      isActive: true,
    });

    expect(result.isActive).toBe(true);
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.createAuditEvent).not.toHaveBeenCalled();
  });

  it("audits ops-only organization updates without writing subscription fields", async () => {
    mocks.findOrganization.mockResolvedValue({
      id: "org-1",
      isActive: true,
      liveChannelsApproved: false,
      timezone: "Asia/Kolkata",
      subscription: {
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
      },
    });
    mocks.getOrganizationSummary.mockResolvedValue({
      id: "org-1",
    });

    await updateOrganizationForPlatformAdmin(
      "org-1",
      { isActive: false, liveChannelsApproved: true },
      "admin-from-session",
    );

    expect(mocks.updateOrganization).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: {
        isActive: false,
        liveChannelsApproved: true,
      },
    });
    expect(mocks.createSubscription).not.toHaveBeenCalled();
    expect(mocks.updateSubscription).not.toHaveBeenCalled();
    expect(mocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ORGANIZATION_UPDATED",
        metadata: {
          changedFields: ["isActive", "liveChannelsApproved"],
        },
      }),
      tx,
    );
  });
});
