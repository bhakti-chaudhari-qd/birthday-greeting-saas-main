import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  PlatformAdminVendorError,
  getVendorForPlatformAdmin,
  updatePlatformVendorSchema,
  updateVendorForPlatformAdmin,
} from "@/lib/admin/vendors";
import { jsonError } from "@/lib/api/response";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id } = await context.params;
    const vendor = await getVendorForPlatformAdmin(id);
    if (!vendor) {
      return jsonError("Vendor not found", 404);
    }

    return NextResponse.json({ data: { vendor } });
  } catch (error) {
    console.error("Get vendor for platform admin failed", error);
    return jsonError("Failed to load vendor", 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id } = await context.params;
    const body = await request.json();
    const input = updatePlatformVendorSchema.parse(body);
    const vendor = await updateVendorForPlatformAdmin(
      id,
      input,
      admin.adminId,
    );

    return NextResponse.json({ data: { vendor } });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid vendor update", 400, error.flatten());
    }

    if (error instanceof PlatformAdminVendorError) {
      const status =
        error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400;
      return jsonError(error.message, status);
    }

    console.error("Update vendor for platform admin failed", error);
    return jsonError("Failed to update vendor", 500);
  }
}
