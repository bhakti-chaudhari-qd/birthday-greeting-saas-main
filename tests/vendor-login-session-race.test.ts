import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  adminFindUnique: vi.fn(),
  vendorUserFindUnique: vi.fn(),
  verifyPassword: vi.fn(),
  createVendorSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    platformAdmin: { findUnique: mocks.adminFindUnique },
    vendorUser: { findUnique: mocks.vendorUserFindUnique },
  },
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: mocks.verifyPassword,
}));

vi.mock("@/lib/auth/session", () => ({ createSession: vi.fn() }));
vi.mock("@/lib/auth/platform-admin-session", () => ({
  createPlatformAdminSession: vi.fn(),
}));

vi.mock("@/lib/auth/vendor-session", () => {
  class VendorSessionCreationError extends Error {}
  return {
    VendorSessionCreationError,
    createVendorSession: mocks.createVendorSession,
  };
});

import { INVALID_CREDENTIALS_MESSAGE } from "@/lib/auth/constants";
import {
  VendorLoginError,
  loginVendorUser,
} from "@/lib/auth/vendor-login";
import {
  VendorSessionCreationError,
} from "@/lib/auth/vendor-session";
import {
  UnifiedLoginError,
  loginUnifiedUser,
} from "@/lib/auth/unified-login";

const vendorUser = {
  id: "vendor-user-1",
  vendorId: "vendor-1",
  email: "owner@example.test",
  mobile: "9876543210",
  passwordHash: "hash",
  name: "Owner",
  isActive: true,
  vendor: {
    id: "vendor-1",
    name: "Acme",
    isActive: true,
    onboardingStatus: "APPROVED",
  },
};

describe("vendor login session race", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.adminFindUnique.mockResolvedValue(null);
    mocks.vendorUserFindUnique.mockResolvedValue(vendorUser);
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.createVendorSession.mockRejectedValue(
      new VendorSessionCreationError(),
    );
  });

  it("returns generic credentials from unified login when suspension wins", async () => {
    await expect(
      loginUnifiedUser({
        identifier: "owner@example.test",
        password: "password",
      }),
    ).rejects.toMatchObject({
      message: INVALID_CREDENTIALS_MESSAGE,
    } satisfies Partial<UnifiedLoginError>);
  });

  it("returns generic credentials from dedicated vendor login", async () => {
    await expect(
      loginVendorUser({
        email: "owner@example.test",
        password: "password",
      }),
    ).rejects.toMatchObject({
      message: INVALID_CREDENTIALS_MESSAGE,
    } satisfies Partial<VendorLoginError>);
  });
});
