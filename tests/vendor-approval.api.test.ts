import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
}));

vi.mock("@/lib/auth/platform-admin-session", () => ({
  getPlatformAdminContext: mocks.getAdmin,
}));

vi.mock("@/lib/admin/vendors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin/vendors")>();
  return {
    ...actual,
    approveVendorForPlatformAdmin: mocks.approve,
    rejectVendorForPlatformAdmin: mocks.reject,
  };
});

import { POST as approve } from "@/app/api/v1/admin/vendors/[id]/approve/route";
import { POST as reject } from "@/app/api/v1/admin/vendors/[id]/reject/route";
import { PlatformAdminVendorError } from "@/lib/admin/vendors";

const context = { params: Promise.resolve({ id: "vendor-1" }) };
const request = new Request("http://localhost", { method: "POST" });

describe("vendor approval APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdmin.mockResolvedValue({ adminId: "admin-1" });
    mocks.approve.mockResolvedValue({ id: "vendor-1" });
    mocks.reject.mockResolvedValue({ id: "vendor-1" });
  });

  it("requires a Platform Admin", async () => {
    mocks.getAdmin.mockResolvedValue(null);

    expect((await approve(request, context)).status).toBe(401);
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("uses explicit approve and reject services", async () => {
    expect((await approve(request, context)).status).toBe(200);
    expect(mocks.approve).toHaveBeenCalledWith("vendor-1", "admin-1");

    expect((await reject(request, context)).status).toBe(200);
    expect(mocks.reject).toHaveBeenCalledWith("vendor-1", "admin-1");
  });

  it("returns conflict for a non-pending transition", async () => {
    mocks.approve.mockRejectedValue(
      new PlatformAdminVendorError("Only pending vendors", "CONFLICT"),
    );

    expect((await approve(request, context)).status).toBe(409);
  });
});
