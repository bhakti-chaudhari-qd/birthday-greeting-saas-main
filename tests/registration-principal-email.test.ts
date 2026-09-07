import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hashPassword: vi.fn(),
  lockAndCheckPrincipalEmail: vi.fn(),
  organizationFindUnique: vi.fn(),
  organizationCreate: vi.fn(),
  userCreate: vi.fn(),
  ensureCategories: vi.fn(),
  transaction: vi.fn(),
}));

const tx = {
  organization: {
    findUnique: mocks.organizationFindUnique,
    create: mocks.organizationCreate,
  },
  user: { create: mocks.userCreate },
};

vi.mock("@/lib/db", () => ({
  prisma: { $transaction: mocks.transaction },
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: mocks.hashPassword,
}));

vi.mock("@/lib/auth/principal-email", () => ({
  lockAndCheckPrincipalEmail: mocks.lockAndCheckPrincipalEmail,
}));

vi.mock("@/lib/contacts/categories", () => ({
  ensureDefaultContactCategories: mocks.ensureCategories,
}));

import {
  RegistrationError,
  createRegisteredOrganization,
} from "@/lib/auth/register";

const input = {
  organizationName: "Acme",
  adminName: "Owner",
  email: "Owner@Example.TEST",
  password: "StrongPassword123",
};

describe("organization principal email creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hashPassword.mockResolvedValue("password-hash");
    mocks.organizationFindUnique.mockResolvedValue(null);
    mocks.organizationCreate.mockResolvedValue({ id: "org-1", name: "Acme" });
    mocks.userCreate.mockResolvedValue({ id: "user-1" });
    mocks.ensureCategories.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(
      (operation: (client: typeof tx) => unknown) => operation(tx),
    );
    mocks.lockAndCheckPrincipalEmail.mockResolvedValue({
      normalizedEmail: "owner@example.test",
      available: true,
    });
  });

  it("claims the shared email lock and inserts the normalized identity", async () => {
    await createRegisteredOrganization(input);

    expect(mocks.lockAndCheckPrincipalEmail).toHaveBeenCalledWith(
      tx,
      input.email,
    );
    expect(mocks.userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "owner@example.test" }),
    });
  });

  it("rejects a cross-principal collision before creating an organization", async () => {
    mocks.lockAndCheckPrincipalEmail.mockResolvedValueOnce({
      normalizedEmail: "owner@example.test",
      available: false,
    });

    await expect(createRegisteredOrganization(input)).rejects.toMatchObject({
      code: "CONFLICT",
    } satisfies Partial<RegistrationError>);
    expect(mocks.organizationCreate).not.toHaveBeenCalled();
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });
});
