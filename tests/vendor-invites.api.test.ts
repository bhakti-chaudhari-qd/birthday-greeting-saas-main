import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  createAndSend: vi.fn(),
  reissue: vi.fn(),
}));

vi.mock("@/lib/auth/platform-admin-session", () => ({
  getPlatformAdminContext: mocks.getAdmin,
}));

vi.mock("@/lib/admin/vendors", () => ({
  listVendorsForPlatformAdmin: vi.fn(),
}));

vi.mock("@/lib/admin/vendor-invites", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/admin/vendor-invites")>();
  return {
    ...actual,
    createVendorAndSendInvite: mocks.createAndSend,
    issueVendorRegistrationInvite: mocks.reissue,
  };
});

import {
  POST as createVendor,
} from "@/app/api/v1/admin/vendors/route";
import {
  POST as reissueInvite,
} from "@/app/api/v1/admin/vendors/[id]/registration-link/route";
import { VendorInviteError } from "@/lib/admin/vendor-invites";

const safeResult = {
  vendor: {
    id: "vendor-1",
    name: "Acme",
    slug: "acme-123",
    mobile: "9876543210",
    referralCode: "ACME-123",
    onboardingStatus: "INVITED",
    isActive: true,
    createdAt: "2026-07-21T08:00:00.000Z",
  },
  invite: {
    id: "invite-1",
    deliveryStatus: "SENT",
    expiresAt: "2026-07-28T08:00:00.000Z",
    sentAt: "2026-07-21T08:00:00.000Z",
  },
};

function request(body: unknown) {
  return new Request("http://localhost/api/v1/admin/vendors", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("platform admin vendor invitation APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdmin.mockResolvedValue({
      adminId: "admin-1",
      email: "admin@example.test",
      name: "Admin",
    });
    mocks.createAndSend.mockResolvedValue(safeResult);
    mocks.reissue.mockResolvedValue(safeResult);
  });

  it("requires admin authentication before vendor creation", async () => {
    mocks.getAdmin.mockResolvedValue(null);
    const response = await createVendor(
      request({ name: "Acme", mobile: "9876543210" }),
    );
    expect(response.status).toBe(401);
    expect(mocks.createAndSend).not.toHaveBeenCalled();
  });

  it("normalizes the mobile and returns only safe invite fields", async () => {
    const response = await createVendor(
      request({ name: " Acme ", mobile: "+91 98765 43210" }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.createAndSend).toHaveBeenCalledWith(
      { name: "Acme", mobile: "9876543210" },
      "admin-1",
    );
    expect(body).toEqual({ data: safeResult });
    expect(JSON.stringify(body)).not.toContain("token");
    expect(JSON.stringify(body)).not.toContain("registration-link");
  });

  it("rejects unknown fields and malformed Indian mobiles", async () => {
    const response = await createVendor(
      request({
        name: "Acme",
        mobile: "12345",
        referralCode: "CLIENT-CONTROLLED",
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.createAndSend).not.toHaveBeenCalled();
  });

  it("returns safe retry metadata when synchronous SMS fails", async () => {
    mocks.createAndSend.mockRejectedValue(
      new VendorInviteError(
        "Vendor invitation could not be sent; it can be retried",
        "DELIVERY_FAILED",
        true,
        "vendor-1",
      ),
    );
    const response = await createVendor(
      request({ name: "Acme", mobile: "9876543210" }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.details).toEqual({
      retryable: true,
      deliveryUncertain: false,
      vendorId: "vendor-1",
    });
  });

  it("reports uncertain delivery without encouraging an automatic retry", async () => {
    mocks.createAndSend.mockRejectedValue(
      new VendorInviteError(
        "SMS delivery is uncertain. Verify with the vendor before reissuing.",
        "DELIVERY_AMBIGUOUS",
        false,
        "vendor-1",
      ),
    );

    const response = await createVendor(
      request({ name: "Acme", mobile: "9876543210" }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toEqual({
      message:
        "SMS delivery is uncertain. Verify with the vendor before reissuing.",
      details: {
        retryable: false,
        deliveryUncertain: true,
        vendorId: "vendor-1",
      },
    });
  });

  it("reissues through the authenticated vendor-scoped route", async () => {
    const response = await reissueInvite(
      new Request(
        "http://localhost/api/v1/admin/vendors/vendor-1/registration-link",
        { method: "POST" },
      ),
      { params: Promise.resolve({ id: "vendor-1" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.reissue).toHaveBeenCalledWith("vendor-1", "admin-1");
  });
});
