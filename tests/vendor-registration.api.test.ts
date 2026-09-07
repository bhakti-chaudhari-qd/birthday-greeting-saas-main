import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeAttempt: vi.fn(),
  inspectInvite: vi.fn(),
  register: vi.fn(),
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  RateLimitError: class RateLimitError extends Error {},
  consumeVendorRegistrationAttempt: mocks.consumeAttempt,
  getClientIp: () => "203.0.113.10",
}));

vi.mock("@/lib/auth/vendor-registration", () => {
  class VendorRegistrationError extends Error {
    constructor(
      message: string,
      readonly code: "INVALID_INVITE" | "CONFLICT",
    ) {
      super(message);
    }
  }

  return {
    INVALID_VENDOR_INVITE_MESSAGE:
      "This registration invitation is invalid or unavailable.",
    VendorRegistrationError,
    hashVendorRegistrationToken: () => "a".repeat(64),
    inspectVendorRegistrationInvite: mocks.inspectInvite,
    registerInvitedVendor: mocks.register,
  };
});

import { POST } from "@/app/api/auth/vendor/register/route";
import {
  INVALID_VENDOR_INVITE_MESSAGE,
  VendorRegistrationError,
} from "@/lib/auth/vendor-registration";

const token = Buffer.alloc(32, 9).toString("base64url");

function request(body: unknown) {
  return new Request("https://app.example.test/api/auth/vendor/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  token,
  contactName: "Vendor Owner",
  email: "owner@example.test",
  password: "StrongPassword123",
};

describe("vendor registration API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeAttempt.mockResolvedValue(undefined);
    mocks.inspectInvite.mockResolvedValue({
      vendorName: "Acme",
      maskedMobile: "******3210",
    });
    mocks.register.mockResolvedValue({ onboardingStatus: "PENDING" });
  });

  it("returns approval-pending without creating a session or leaking token", async () => {
    const response = await POST(request(validBody));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ data: { onboardingStatus: "PENDING" } });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(body)).not.toContain(token);
    expect(mocks.consumeAttempt).toHaveBeenCalledWith(
      "203.0.113.10",
      "a".repeat(64),
    );
    expect(mocks.inspectInvite.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.consumeAttempt.mock.invocationCallOrder[0],
    );
  });

  it("strictly rejects client-supplied mobile", async () => {
    const response = await POST(
      request({ ...validBody, mobile: "9999999999" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.consumeAttempt).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it.each(["expired", "used", "revoked", "unknown"])(
    "returns the same safe response for an %s invite",
    async () => {
      mocks.inspectInvite.mockResolvedValueOnce(null);

      const response = await POST(request(validBody));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({
        error: { message: INVALID_VENDOR_INVITE_MESSAGE },
      });
      expect(JSON.stringify(body)).not.toContain(token);
      expect(mocks.consumeAttempt).not.toHaveBeenCalled();
      expect(mocks.register).not.toHaveBeenCalled();
    },
  );

  it("returns a safe conflict for duplicate principal identifiers", async () => {
    mocks.register.mockRejectedValueOnce(
      new VendorRegistrationError(
        "An account with this email or mobile already exists.",
        "CONFLICT",
      ),
    );

    const response = await POST(request(validBody));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: {
        message: "An account with this email or mobile already exists.",
      },
    });
  });
});
