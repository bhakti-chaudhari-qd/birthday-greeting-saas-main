import {
  Prisma,
  VendorOnboardingStatus,
  VendorRegistrationInviteDeliveryStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderSendError } from "@/lib/messaging/providers/types";

const mocks = vi.hoisted(() => ({
  vendorCreate: vi.fn(),
  vendorFindUnique: vi.fn(),
  vendorUpdate: vi.fn(),
  inviteUpdateMany: vi.fn(),
  inviteFindFirst: vi.fn(),
  inviteCreate: vi.fn(),
  inviteUpdate: vi.fn(),
  transaction: vi.fn(),
  providerSend: vi.fn(),
  createAuditEvent: vi.fn(),
}));

const tx = {
  vendor: {
    create: mocks.vendorCreate,
    findUnique: mocks.vendorFindUnique,
    update: mocks.vendorUpdate,
  },
  vendorRegistrationInvite: {
    findFirst: mocks.inviteFindFirst,
    updateMany: mocks.inviteUpdateMany,
    create: mocks.inviteCreate,
    update: mocks.inviteUpdate,
  },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: {
      create: mocks.vendorCreate,
      findUnique: mocks.vendorFindUnique,
      update: mocks.vendorUpdate,
    },
    vendorRegistrationInvite: {
      update: mocks.inviteUpdate,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/admin/audit", () => ({
  PLATFORM_ADMIN_AUDIT_ACTIONS: {
    VENDOR_CREATED: "VENDOR_CREATED",
    VENDOR_INVITE_SENT: "VENDOR_INVITE_SENT",
  },
  createPlatformAdminAuditEvent: mocks.createAuditEvent,
}));

import {
  createVendorAndSendInvite,
  issueVendorRegistrationInvite,
  VendorInviteError,
} from "@/lib/admin/vendor-invites";

const now = new Date("2026-07-21T08:00:00.000Z");
const vendor = {
  id: "vendor-1",
  name: "Acme Messaging",
  slug: "acme-messaging-0101010101",
  mobile: "9876543210",
  referralCode: "ACMEMESSAGING-0101010101",
  onboardingStatus: VendorOnboardingStatus.DRAFT,
  isActive: true,
  createdAt: now,
};
const smsConfig = {
  appUrl: "https://app.example.test/",
  baseUrl: "https://sms.example.test/",
  sendPath: "/send.aspx",
  username: "user",
  password: "pass",
  route: "trans1",
  senderId: "BIRTHD",
  dltTemplateId: "1707000000000000000",
  invitationBodyTemplate:
    "Register at {{registrationUrl}} for {{vendorName}}.",
  requestTimeoutMs: 10_000,
  successStatusCode: 1,
};

describe("vendor invitation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      (operation: ((client: typeof tx) => unknown) | unknown[]) =>
        typeof operation === "function" ? operation(tx) : Promise.all(operation),
    );
    mocks.vendorCreate.mockResolvedValue(vendor);
    mocks.vendorFindUnique.mockResolvedValue({
      id: vendor.id,
      name: vendor.name,
      mobile: vendor.mobile,
      onboardingStatus: VendorOnboardingStatus.DRAFT,
      _count: { users: 0 },
    });
    mocks.inviteUpdateMany.mockResolvedValue({ count: 1 });
    mocks.inviteFindFirst.mockResolvedValue(null);
    mocks.inviteCreate.mockResolvedValue({ id: "invite-1" });
    mocks.inviteUpdate.mockResolvedValue({
      id: "invite-1",
      deliveryStatus: VendorRegistrationInviteDeliveryStatus.SENT,
      expiresAt: new Date("2026-07-28T08:00:00.000Z"),
      sentAt: now,
    });
    mocks.vendorUpdate.mockImplementation(({ data }) =>
      Promise.resolve({
        ...vendor,
        onboardingStatus:
          data.onboardingStatus ?? VendorOnboardingStatus.DRAFT,
      }),
    );
    mocks.providerSend.mockResolvedValue({
      providerMessageId: "provider-message-1",
      status: "SENT",
    });
  });

  const dependencies = {
    now: () => now,
    randomBytes: (size: number) => Buffer.alloc(size, 1),
    getSmsConfig: () => smsConfig,
    createSmsProvider: () => ({
      name: "CUSTOM_HTTP",
      send: mocks.providerSend,
    }),
  };

  it("creates a draft vendor and sends a seven-day one-time invite", async () => {
    const result = await createVendorAndSendInvite(
      { name: vendor.name, mobile: vendor.mobile },
      "admin-1",
      dependencies,
    );

    const rawToken = Buffer.alloc(32, 1).toString("base64url");
    const inviteData = mocks.inviteCreate.mock.calls[0][0].data;
    expect(inviteData.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(inviteData.tokenHash).not.toBe(rawToken);
    expect(inviteData.expiresAt.toISOString()).toBe(
      "2026-07-28T08:00:00.000Z",
    );
    expect(mocks.inviteUpdateMany).toHaveBeenCalledWith({
      where: {
        vendorId: vendor.id,
        usedAt: null,
        revokedAt: null,
        deliveryStatus: {
          not: VendorRegistrationInviteDeliveryStatus.PENDING,
        },
      },
      data: { revokedAt: now },
    });

    const send = mocks.providerSend.mock.calls[0][0];
    expect(send.recipient).toBe("9876543210");
    expect(send.dltTemplateId).toBe("1707000000000000000");
    expect(send.body).toContain(
      `https://app.example.test/vendor/register?token=${rawToken}`,
    );
    expect(send.body).toContain(vendor.name);
    expect(result.vendor.onboardingStatus).toBe("INVITED");
    expect(mocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAdminId: "admin-1",
        action: "VENDOR_CREATED",
        targetId: vendor.id,
      }),
      tx,
    );
    expect(mocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAdminId: "admin-1",
        action: "VENDOR_INVITE_SENT",
        targetId: vendor.id,
      }),
      tx,
    );
    expect(JSON.stringify(result)).not.toContain(rawToken);
    expect(JSON.stringify(result)).not.toContain("/vendor/register");
  });

  it("keeps timeout outcomes valid and marks delivery ambiguous", async () => {
    mocks.providerSend.mockRejectedValueOnce(
      new ProviderSendError("secret provider detail", "PROVIDER_TIMEOUT"),
    );

    await expect(
      issueVendorRegistrationInvite(vendor.id, "admin-1", dependencies),
    ).rejects.toMatchObject({
      code: "DELIVERY_AMBIGUOUS",
      retryable: false,
      vendorId: vendor.id,
    } satisfies Partial<VendorInviteError>);

    expect(mocks.inviteUpdate).toHaveBeenLastCalledWith({
      where: { id: "invite-1" },
      data: {
        deliveryStatus: VendorRegistrationInviteDeliveryStatus.AMBIGUOUS,
        deliveryError: "Platform SMS failed (PROVIDER_TIMEOUT)",
      },
    });
    expect(mocks.vendorUpdate).toHaveBeenLastCalledWith({
      where: { id: vendor.id },
      data: { onboardingStatus: VendorOnboardingStatus.INVITED },
    });
  });

  it("revokes definite client rejections and allows an explicit retry", async () => {
    mocks.providerSend.mockRejectedValueOnce(
      new ProviderSendError("bad recipient", "INVALID_RECIPIENT"),
    );

    await expect(
      issueVendorRegistrationInvite(vendor.id, "admin-1", dependencies),
    ).rejects.toMatchObject({
      code: "DELIVERY_FAILED",
      retryable: true,
    } satisfies Partial<VendorInviteError>);

    expect(mocks.inviteUpdate).toHaveBeenLastCalledWith({
      where: { id: "invite-1" },
      data: {
        deliveryStatus: VendorRegistrationInviteDeliveryStatus.FAILED,
        revokedAt: now,
        deliveryError: "Platform SMS failed (INVALID_RECIPIENT)",
      },
    });
  });

  it("treats persistence failure after provider acceptance as ambiguous", async () => {
    let functionTransactions = 0;
    mocks.transaction.mockImplementation(
      (operation: ((client: typeof tx) => unknown) | unknown[]) => {
        if (typeof operation !== "function") return Promise.all(operation);
        functionTransactions += 1;
        if (functionTransactions === 2) {
          return Promise.reject(new Error("database unavailable"));
        }
        return operation(tx);
      },
    );

    await expect(
      issueVendorRegistrationInvite(vendor.id, "admin-1", dependencies),
    ).rejects.toMatchObject({
      code: "DELIVERY_AMBIGUOUS",
      retryable: false,
    } satisfies Partial<VendorInviteError>);
    expect(mocks.providerSend).toHaveBeenCalledTimes(1);
    expect(mocks.inviteUpdate).toHaveBeenLastCalledWith({
      where: { id: "invite-1" },
      data: {
        deliveryStatus: VendorRegistrationInviteDeliveryStatus.AMBIGUOUS,
        deliveryError: "Platform SMS delivery failed",
      },
    });
  });

  it("rejects issuance while another SMS remains pending", async () => {
    mocks.inviteFindFirst.mockResolvedValueOnce({ id: "invite-pending" });

    await expect(
      issueVendorRegistrationInvite(vendor.id, "admin-1", dependencies),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    } satisfies Partial<VendorInviteError>);
    expect(mocks.inviteCreate).not.toHaveBeenCalled();
    expect(mocks.providerSend).not.toHaveBeenCalled();
  });

  it("expires a stale pending lease before creating the replacement", async () => {
    mocks.inviteUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    await issueVendorRegistrationInvite(vendor.id, "admin-1", dependencies);

    expect(mocks.inviteUpdateMany).toHaveBeenNthCalledWith(1, {
      where: {
        vendorId: vendor.id,
        deliveryStatus: VendorRegistrationInviteDeliveryStatus.PENDING,
        usedAt: null,
        revokedAt: null,
        createdAt: { lte: new Date("2026-07-21T07:50:00.000Z") },
      },
      data: {
        deliveryStatus: VendorRegistrationInviteDeliveryStatus.FAILED,
        revokedAt: now,
        deliveryError:
          "Invitation dispatch lease expired before an SMS outcome was recorded",
      },
    });
    expect(mocks.inviteUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.inviteFindFirst.mock.invocationCallOrder[0],
    );
    expect(mocks.inviteCreate).toHaveBeenCalledTimes(1);
  });

  it("maps the pending-invite unique race to a safe conflict", async () => {
    mocks.inviteCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: {
          target: "VendorRegistrationInvite_one_active_pending_per_vendor",
        },
      }),
    );

    await expect(
      issueVendorRegistrationInvite(vendor.id, "admin-1", dependencies),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "An invitation SMS is already being dispatched",
    } satisfies Partial<VendorInviteError>);
    expect(mocks.providerSend).not.toHaveBeenCalled();
  });

  it("rejects an invitation body with unapproved substitutions", async () => {
    await expect(
      issueVendorRegistrationInvite(vendor.id, "admin-1", {
        ...dependencies,
        getSmsConfig: () => ({
          ...smsConfig,
          invitationBodyTemplate:
            "Register {{registrationUrl}} for {{vendorName}} with {{secret}}.",
        }),
      }),
    ).rejects.toMatchObject({ code: "DELIVERY_FAILED", retryable: true });
    expect(mocks.providerSend).not.toHaveBeenCalled();
  });
});
