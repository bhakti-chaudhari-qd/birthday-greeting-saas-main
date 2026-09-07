import { VendorOnboardingStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  adminFindUnique: vi.fn(),
  vendorUserFindUnique: vi.fn(),
  vendorFindFirst: vi.fn(),
  vendorSessionFindUnique: vi.fn(),
  verifyPassword: vi.fn(),
  cookieGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mocks.cookieGet,
  })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    platformAdmin: { findUnique: mocks.adminFindUnique },
    vendorUser: { findUnique: mocks.vendorUserFindUnique },
    vendor: { findFirst: mocks.vendorFindFirst },
    vendorSession: { findUnique: mocks.vendorSessionFindUnique },
  },
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: mocks.verifyPassword,
}));

import { INVALID_CREDENTIALS_MESSAGE } from "@/lib/auth/constants";
import {
  VendorReferralError,
  resolveOptionalVendorReferral,
} from "@/lib/auth/vendor-referral";
import { getVendorAuthContext } from "@/lib/auth/vendor-session";
import {
  VendorLoginError,
  authenticateVendorUser,
} from "@/lib/auth/vendor-login";
import {
  UnifiedLoginError,
  authenticateUnifiedUser,
} from "@/lib/auth/unified-login";

function vendorUser(status: VendorOnboardingStatus) {
  return {
    id: "vendor-user-1",
    vendorId: "vendor-1",
    email: null,
    mobile: "9876543210",
    passwordHash: "hash",
    name: "Vendor User",
    isActive: true,
    vendor: {
      id: "vendor-1",
      name: "Acme",
      slug: "acme",
      referralCode: "ACME",
      isActive: true,
      onboardingStatus: status,
    },
  };
}

describe("vendor approval auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.adminFindUnique.mockResolvedValue(null);
    mocks.cookieGet.mockReturnValue({ value: "session-token" });
  });

  it("authenticates an approved vendor by normalized Indian mobile", async () => {
    mocks.vendorUserFindUnique.mockResolvedValue(
      vendorUser(VendorOnboardingStatus.APPROVED),
    );

    const result = await authenticateUnifiedUser({
      identifier: "+91 98765 43210",
      password: "password",
    });

    expect(mocks.vendorUserFindUnique).toHaveBeenCalledWith({
      where: { mobile: "9876543210" },
      include: { vendor: true },
    });
    expect(result.portal).toBe("vendor");
  });

  it.each([
    VendorOnboardingStatus.PENDING,
    VendorOnboardingStatus.REJECTED,
  ])("returns generic credentials for a %s vendor", async (status) => {
    mocks.vendorUserFindUnique.mockResolvedValue(vendorUser(status));

    await expect(
      authenticateUnifiedUser({
        identifier: "9876543210",
        password: "password",
      }),
    ).rejects.toMatchObject({
      message: INVALID_CREDENTIALS_MESSAGE,
    } satisfies Partial<UnifiedLoginError>);
  });

  it("keeps organization users ahead of vendors for an email collision", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      email: "shared@example.test",
      passwordHash: "hash",
      name: "Client",
      role: "ADMIN",
      organizationId: "org-1",
      isActive: true,
      organization: { isActive: true },
    });
    mocks.vendorUserFindUnique.mockResolvedValue({
      ...vendorUser(VendorOnboardingStatus.APPROVED),
      email: "shared@example.test",
    });

    const result = await authenticateUnifiedUser({
      identifier: "shared@example.test",
      password: "password",
    });

    expect(result.portal).toBe("client");
  });

  it("blocks pending vendors in the dedicated vendor login", async () => {
    mocks.vendorUserFindUnique.mockResolvedValue(
      vendorUser(VendorOnboardingStatus.PENDING),
    );

    await expect(
      authenticateVendorUser({
        email: "vendor@example.test",
        password: "password",
      }),
    ).rejects.toBeInstanceOf(VendorLoginError);
  });

  it("invalidates an existing session after rejection", async () => {
    mocks.vendorSessionFindUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      vendorId: "vendor-1",
      vendorUser: vendorUser(VendorOnboardingStatus.REJECTED),
    });

    await expect(getVendorAuthContext()).resolves.toBeNull();
  });

  it("requires an approved and active vendor for referral resolution", async () => {
    mocks.vendorFindFirst.mockResolvedValue(null);

    await expect(resolveOptionalVendorReferral("ACME")).rejects.toBeInstanceOf(
      VendorReferralError,
    );
    expect(mocks.vendorFindFirst).toHaveBeenCalledWith({
      where: {
        referralCode: "ACME",
        isActive: true,
        onboardingStatus: VendorOnboardingStatus.APPROVED,
      },
      select: { id: true },
    });
  });
});
