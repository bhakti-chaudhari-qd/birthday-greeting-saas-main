import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class PlatformAdminOrgError extends Error {}
  class PlatformAdminOrgInactiveError extends Error {}

  return {
    PlatformAdminOrgError,
    PlatformAdminOrgInactiveError,
    getPlatformAdminContext: vi.fn(),
    sendPasswordReset: vi.fn(),
  };
});

vi.mock("@/lib/auth/platform-admin-session", () => ({
  getPlatformAdminContext: mocks.getPlatformAdminContext,
}));

vi.mock("@/lib/admin/org-ops", () => ({
  PlatformAdminOrgError: mocks.PlatformAdminOrgError,
  PlatformAdminOrgInactiveError: mocks.PlatformAdminOrgInactiveError,
  sendOrganizationUserPasswordResetForPlatformAdmin:
    mocks.sendPasswordReset,
}));

import { POST } from "@/app/api/v1/admin/organizations/[id]/users/[userId]/password-reset/route";
import { RateLimitError } from "@/lib/auth/rate-limit";

function resetRequest(body?: object) {
  return new Request(
    "http://localhost/api/v1/admin/organizations/org-1/users/user-1/password-reset",
    {
      method: "POST",
      ...(body
        ? {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    },
  );
}

const routeContext = {
  params: Promise.resolve({ id: "org-1", userId: "user-1" }),
};

describe("platform admin organization user password reset API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlatformAdminContext.mockResolvedValue({
      adminId: "admin-1",
      email: "admin@example.test",
      name: "Platform Admin",
    });
  });

  it("requires platform admin authentication", async () => {
    mocks.getPlatformAdminContext.mockResolvedValue(null);

    const response = await POST(resetRequest(), routeContext);

    expect(response.status).toBe(401);
    expect(mocks.sendPasswordReset).not.toHaveBeenCalled();
  });

  it("accepts no email or password input", async () => {
    const response = await POST(
      resetRequest({
        email: "attacker@example.test",
        password: "manual-password",
      }),
      routeContext,
    );

    expect(response.status).toBe(400);
    expect(mocks.sendPasswordReset).not.toHaveBeenCalled();
  });

  it("uses only route identity and returns no reset secret", async () => {
    mocks.sendPasswordReset.mockResolvedValue({
      token: "raw-secret-token",
      resetUrl: "http://localhost/reset-password?token=raw-secret-token",
    });

    const response = await POST(resetRequest(), routeContext);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.sendPasswordReset).toHaveBeenCalledWith({
      adminId: "admin-1",
      organizationId: "org-1",
      userId: "user-1",
    });
    expect(body).toEqual({
      data: { message: "Password reset email sent" },
    });
    expect(JSON.stringify(body)).not.toContain("raw-secret-token");
    expect(JSON.stringify(body)).not.toContain("reset-password");
  });

  it("returns 404 when the user is outside the organization scope", async () => {
    mocks.sendPasswordReset.mockRejectedValue(
      new mocks.PlatformAdminOrgError("User not found in this organization"),
    );

    const response = await POST(resetRequest(), routeContext);

    expect(response.status).toBe(404);
  });

  it.each(["Organization is inactive", "User is inactive"])(
    "rejects inactive state: %s",
    async (message) => {
      mocks.sendPasswordReset.mockRejectedValue(
        new mocks.PlatformAdminOrgInactiveError(message),
      );

      const response = await POST(resetRequest(), routeContext);

      expect(response.status).toBe(409);
    },
  );

  it("returns 429 when the admin-target bucket is rate limited", async () => {
    mocks.sendPasswordReset.mockRejectedValue(new RateLimitError());

    const response = await POST(resetRequest(), routeContext);

    expect(response.status).toBe(429);
  });
});
