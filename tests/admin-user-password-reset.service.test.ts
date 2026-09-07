import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  sendPasswordResetForUser: vi.fn(),
  throttleKey: vi.fn(
    (adminId: string, userId: string) =>
      `admin-password-reset:${adminId}:${userId}`,
  ),
  recordAdminPasswordReset: vi.fn(),
  createAuditEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: mocks.findFirst,
    },
  },
}));

vi.mock("@/lib/auth/email-flows", () => ({
  sendPasswordResetForUser: mocks.sendPasswordResetForUser,
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  adminPasswordResetThrottleKey: mocks.throttleKey,
  recordAdminPasswordReset: mocks.recordAdminPasswordReset,
}));

vi.mock("@/lib/admin/organizations", () => ({
  getOrganizationSummaryForPlatformAdmin: vi.fn(),
  listOrganizationsForPlatformAdmin: vi.fn(),
}));

vi.mock("@/lib/admin/audit", () => ({
  PLATFORM_ADMIN_AUDIT_ACTIONS: {
    PASSWORD_RESET_REQUESTED: "ORGANIZATION_USER_PASSWORD_RESET_REQUESTED",
  },
  createPlatformAdminAuditEvent: mocks.createAuditEvent,
}));

import {
  PlatformAdminOrgError,
  PlatformAdminOrgInactiveError,
  sendOrganizationUserPasswordResetForPlatformAdmin,
} from "@/lib/admin/org-ops";

const input = {
  adminId: "admin-1",
  organizationId: "org-1",
  userId: "user-1",
};

describe("platform admin organization user password reset service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordAdminPasswordReset.mockReset().mockResolvedValue(undefined);
    mocks.createAuditEvent.mockReset().mockResolvedValue(undefined);
    mocks.sendPasswordResetForUser.mockReset().mockResolvedValue(undefined);
    mocks.findFirst.mockResolvedValue({
      id: "user-1",
      email: "stored@example.test",
      isActive: true,
      organization: { isActive: true },
    });
  });

  it("scopes the target by organization and user and uses stored identity", async () => {
    await sendOrganizationUserPasswordResetForPlatformAdmin(input);

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        id: "user-1",
        organizationId: "org-1",
      },
      select: {
        id: true,
        email: true,
        isActive: true,
        organization: {
          select: { isActive: true },
        },
      },
    });
    expect(mocks.throttleKey).toHaveBeenCalledWith("admin-1", "user-1");
    expect(mocks.recordAdminPasswordReset).toHaveBeenCalledWith(
      "admin-password-reset:admin-1:user-1",
    );
    expect(mocks.sendPasswordResetForUser).toHaveBeenCalledWith({
      id: "user-1",
      email: "stored@example.test",
    });
    expect(mocks.createAuditEvent).toHaveBeenCalledWith({
      actorAdminId: "admin-1",
      organizationId: "org-1",
      action: "ORGANIZATION_USER_PASSWORD_RESET_REQUESTED",
      targetType: "organization_user",
      targetId: "user-1",
    });
    expect(
      mocks.createAuditEvent.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.sendPasswordResetForUser.mock.invocationCallOrder[0]!);
  });

  it("rejects a user outside the scoped organization", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      sendOrganizationUserPasswordResetForPlatformAdmin(input),
    ).rejects.toBeInstanceOf(PlatformAdminOrgError);
    expect(mocks.recordAdminPasswordReset).not.toHaveBeenCalled();
    expect(mocks.sendPasswordResetForUser).not.toHaveBeenCalled();
    expect(mocks.createAuditEvent).not.toHaveBeenCalled();
  });

  it.each([
    ["inactive organization", true, false],
    ["inactive user", false, true],
  ])("rejects an %s", async (_label, userActive, organizationActive) => {
    mocks.findFirst.mockResolvedValue({
      id: "user-1",
      email: "stored@example.test",
      isActive: userActive,
      organization: { isActive: organizationActive },
    });

    await expect(
      sendOrganizationUserPasswordResetForPlatformAdmin(input),
    ).rejects.toBeInstanceOf(PlatformAdminOrgInactiveError);
    expect(mocks.recordAdminPasswordReset).not.toHaveBeenCalled();
    expect(mocks.sendPasswordResetForUser).not.toHaveBeenCalled();
    expect(mocks.createAuditEvent).not.toHaveBeenCalled();
  });

  it("does not issue or email a token when rate limited", async () => {
    mocks.recordAdminPasswordReset.mockRejectedValue(
      new Error("rate limited"),
    );

    await expect(
      sendOrganizationUserPasswordResetForPlatformAdmin(input),
    ).rejects.toThrow("rate limited");
    expect(mocks.sendPasswordResetForUser).not.toHaveBeenCalled();
    expect(mocks.createAuditEvent).not.toHaveBeenCalled();
  });

  it("does not send email when recording the request audit fails", async () => {
    mocks.createAuditEvent.mockRejectedValue(new Error("audit unavailable"));

    await expect(
      sendOrganizationUserPasswordResetForPlatformAdmin(input),
    ).rejects.toThrow("audit unavailable");
    expect(mocks.sendPasswordResetForUser).not.toHaveBeenCalled();
  });

  it("retains the attempted-request audit when email delivery fails", async () => {
    mocks.sendPasswordResetForUser.mockRejectedValue(
      new Error("email unavailable"),
    );

    await expect(
      sendOrganizationUserPasswordResetForPlatformAdmin(input),
    ).rejects.toThrow("email unavailable");
    expect(mocks.createAuditEvent).toHaveBeenCalledOnce();
  });
});
