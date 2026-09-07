import {
  VendorOnboardingStatus,
  VendorRegistrationInviteDeliveryStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hashPassword: vi.fn(),
  inspectFindFirst: vi.fn(),
  inviteFindFirst: vi.fn(),
  inviteUpdateMany: vi.fn(),
  vendorUserFindFirst: vi.fn(),
  organizationUserFindFirst: vi.fn(),
  platformAdminFindFirst: vi.fn(),
  vendorUserCreate: vi.fn(),
  vendorUpdateMany: vi.fn(),
  transaction: vi.fn(),
  createAuditEvent: vi.fn(),
  lockAndCheckPrincipalEmail: vi.fn(),
}));

const tx = {
  vendorRegistrationInvite: {
    findFirst: mocks.inviteFindFirst,
    updateMany: mocks.inviteUpdateMany,
  },
  vendorUser: {
    findFirst: mocks.vendorUserFindFirst,
    create: mocks.vendorUserCreate,
  },
  user: { findFirst: mocks.organizationUserFindFirst },
  platformAdmin: { findFirst: mocks.platformAdminFindFirst },
  vendor: { updateMany: mocks.vendorUpdateMany },
};

vi.mock("@/lib/auth/password", () => ({
  hashPassword: mocks.hashPassword,
}));

vi.mock("@/lib/auth/principal-email", () => ({
  lockAndCheckPrincipalEmail: mocks.lockAndCheckPrincipalEmail,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorRegistrationInvite: {
      findFirst: mocks.inspectFindFirst,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/admin/audit", () => ({
  PLATFORM_ADMIN_AUDIT_ACTIONS: {
    VENDOR_REGISTRATION_SUBMITTED: "VENDOR_REGISTRATION_SUBMITTED",
  },
  createPlatformAdminAuditEvent: mocks.createAuditEvent,
}));

import {
  INVALID_VENDOR_INVITE_MESSAGE,
  VendorRegistrationError,
  inspectVendorRegistrationInvite,
  registerInvitedVendor,
} from "@/lib/auth/vendor-registration";

const now = new Date("2026-07-21T08:00:00.000Z");
const token = Buffer.alloc(32, 7).toString("base64url");
const input = {
  token,
  contactName: "Vendor Owner",
  email: "owner@example.test",
  password: "StrongPassword123",
};
const invite = {
  id: "invite-1",
  vendor: {
    id: "vendor-1",
    mobile: "9876543210",
    onboardingStatus: VendorOnboardingStatus.INVITED,
  },
};

describe("vendor registration service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hashPassword.mockResolvedValue("hashed-password");
    mocks.inspectFindFirst.mockResolvedValue({
      vendor: { name: "Acme Messaging", mobile: "9876543210" },
    });
    mocks.inviteFindFirst.mockResolvedValue(invite);
    mocks.inviteUpdateMany.mockResolvedValue({ count: 1 });
    mocks.vendorUserFindFirst.mockResolvedValue(null);
    mocks.organizationUserFindFirst.mockResolvedValue(null);
    mocks.platformAdminFindFirst.mockResolvedValue(null);
    mocks.vendorUserCreate.mockResolvedValue({ id: "vendor-user-1" });
    mocks.vendorUpdateMany.mockResolvedValue({ count: 1 });
    mocks.lockAndCheckPrincipalEmail.mockResolvedValue({
      normalizedEmail: input.email,
      available: true,
    });
    mocks.transaction.mockImplementation(
      (operation: (client: typeof tx) => unknown) => operation(tx),
    );
  });

  it("inspects only safe invite display data", async () => {
    mocks.inspectFindFirst.mockResolvedValue({
      vendor: {
        name: "Acme Messaging",
        mobile: "9876543210",
      },
    });

    const result = await inspectVendorRegistrationInvite(token, now);

    expect(result).toEqual({
      vendorName: "Acme Messaging",
      maskedMobile: "******3210",
    });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain("9876543210");
    expect(mocks.inspectFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deliveryStatus: {
            in: [
              VendorRegistrationInviteDeliveryStatus.SENT,
              VendorRegistrationInviteDeliveryStatus.AMBIGUOUS,
            ],
          },
          usedAt: null,
          revokedAt: null,
        }),
      }),
    );
  });

  it("hashes before the transaction and uses the invite mobile", async () => {
    await expect(registerInvitedVendor(input, now)).resolves.toEqual({
      onboardingStatus: "PENDING",
    });

    expect(mocks.inspectFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.hashPassword.mock.invocationCallOrder[0],
    );
    expect(mocks.hashPassword.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.transaction.mock.invocationCallOrder[0],
    );
    expect(mocks.vendorUserCreate).toHaveBeenCalledWith({
      data: {
        vendorId: "vendor-1",
        email: "owner@example.test",
        mobile: "9876543210",
        passwordHash: "hashed-password",
        name: "Vendor Owner",
      },
    });
    expect(mocks.vendorUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "vendor-1",
        onboardingStatus: VendorOnboardingStatus.INVITED,
      },
      data: {
        onboardingStatus: VendorOnboardingStatus.PENDING,
        registrationSubmittedAt: now,
      },
    });
    expect(mocks.createAuditEvent).toHaveBeenCalledWith(
      {
        actorAdminId: null,
        action: "VENDOR_REGISTRATION_SUBMITTED",
        targetType: "vendor",
        targetId: "vendor-1",
        before: { status: "INVITED" },
        after: { status: "PENDING" },
      },
      tx,
    );
    expect(JSON.stringify(mocks.createAuditEvent.mock.calls[0])).not.toContain(
      "owner@example.test",
    );
    expect(JSON.stringify(mocks.createAuditEvent.mock.calls[0])).not.toContain(
      token,
    );
  });

  it("rejects an invalid invite before hashing its password", async () => {
    mocks.inspectFindFirst.mockResolvedValueOnce(null);

    await expect(registerInvitedVendor(input, now)).rejects.toMatchObject({
      code: "INVALID_INVITE",
    } satisfies Partial<VendorRegistrationError>);
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("allows only one concurrent atomic token claim", async () => {
    let claimed = false;
    mocks.inviteUpdateMany.mockImplementation(async () => {
      if (claimed) return { count: 0 };
      claimed = true;
      return { count: 1 };
    });

    const results = await Promise.allSettled([
      registerInvitedVendor(input, now),
      registerInvitedVendor(
        { ...input, email: "other@example.test" },
        now,
      ),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      1,
    );
    const rejected = results.find(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected",
    );
    expect(rejected?.reason).toMatchObject({
      code: "INVALID_INVITE",
      message: INVALID_VENDOR_INVITE_MESSAGE,
    });
    expect(mocks.vendorUserCreate).toHaveBeenCalledTimes(1);
  });

  it("rolls the token claim back when a later check fails", async () => {
    let tokenUsed = false;
    mocks.inviteUpdateMany.mockImplementation(async () => {
      tokenUsed = true;
      return { count: 1 };
    });
    mocks.lockAndCheckPrincipalEmail.mockResolvedValueOnce({
      normalizedEmail: input.email,
      available: false,
    });
    mocks.transaction.mockImplementation(
      async (operation: (client: typeof tx) => unknown) => {
        const before = tokenUsed;
        try {
          return await operation(tx);
        } catch (error) {
          tokenUsed = before;
          throw error;
        }
      },
    );

    await expect(registerInvitedVendor(input, now)).rejects.toMatchObject({
      code: "CONFLICT",
    } satisfies Partial<VendorRegistrationError>);
    expect(tokenUsed).toBe(false);
    expect(mocks.vendorUserCreate).not.toHaveBeenCalled();
  });
});
