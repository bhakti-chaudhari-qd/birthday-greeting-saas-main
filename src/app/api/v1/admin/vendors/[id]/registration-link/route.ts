import { NextResponse } from "next/server";

import {
  VendorInviteError,
  issueVendorRegistrationInvite,
} from "@/lib/admin/vendor-invites";
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
    if (!id.trim()) {
      return jsonError("Invalid vendor id", 400);
    }

    const result = await issueVendorRegistrationInvite(id, admin.adminId);
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof VendorInviteError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "CONFLICT"
            ? 409
            : 503;
      return jsonError(error.message, status, {
        retryable: error.retryable,
        deliveryUncertain: error.code === "DELIVERY_AMBIGUOUS",
        ...(error.vendorId ? { vendorId: error.vendorId } : {}),
      });
    }

    console.error("Reissue vendor registration invitation failed", error);
    return jsonError("Failed to issue vendor invitation", 500);
  }
}
