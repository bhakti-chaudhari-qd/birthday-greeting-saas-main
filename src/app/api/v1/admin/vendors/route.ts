import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { listVendorsForPlatformAdmin } from "@/lib/admin/vendors";
import {
  VendorInviteError,
  createPlatformVendorSchema,
  createVendorAndSendInvite,
} from "@/lib/admin/vendor-invites";
import { jsonError } from "@/lib/api/response";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const vendors = await listVendorsForPlatformAdmin();
    return NextResponse.json({ data: { vendors } });
  } catch (error) {
    console.error("List vendors for platform admin failed", error);
    return jsonError("Failed to load vendors", 500);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const input = createPlatformVendorSchema.parse(await request.json());
    const result = await createVendorAndSendInvite(input, admin.adminId);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return jsonError(
        "Invalid vendor",
        400,
        error instanceof ZodError ? error.flatten() : undefined,
      );
    }
    if (error instanceof VendorInviteError) {
      const status =
        error.code === "CONFLICT"
          ? 409
          : error.code === "NOT_FOUND"
            ? 404
            : 503;
      return jsonError(error.message, status, {
        retryable: error.retryable,
        deliveryUncertain: error.code === "DELIVERY_AMBIGUOUS",
        ...(error.vendorId ? { vendorId: error.vendorId } : {}),
      });
    }

    console.error("Create vendor for platform admin failed", error);
    return jsonError("Failed to create vendor", 500);
  }
}
