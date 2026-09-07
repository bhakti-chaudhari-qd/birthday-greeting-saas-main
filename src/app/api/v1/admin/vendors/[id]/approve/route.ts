import { NextResponse } from "next/server";

import {
  PlatformAdminVendorError,
  approveVendorForPlatformAdmin,
} from "@/lib/admin/vendors";
import { jsonError } from "@/lib/api/response";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id } = await context.params;
    const vendor = await approveVendorForPlatformAdmin(id, admin.adminId);
    return NextResponse.json({ data: { vendor } });
  } catch (error) {
    if (error instanceof PlatformAdminVendorError) {
      const status =
        error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400;
      return jsonError(error.message, status);
    }

    console.error("Approve vendor failed", error);
    return jsonError("Failed to approve vendor", 500);
  }
}
