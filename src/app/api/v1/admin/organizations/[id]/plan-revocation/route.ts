import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import {
  PlatformAdminOrgError,
  PlatformAdminPlanRevokeError,
  revokePlanForPlatformAdmin,
} from "@/lib/admin/org-ops";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Revokes this org's paid plan and drops it to FREE immediately. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id } = await context.params;
    const organization = await revokePlanForPlatformAdmin(id, admin.adminId);

    return NextResponse.json({ data: { organization } });
  } catch (error) {
    if (error instanceof PlatformAdminOrgError) {
      return jsonError(error.message, 404);
    }
    if (error instanceof PlatformAdminPlanRevokeError) {
      return jsonError(error.message, 409);
    }
    console.error("Revoke plan failed", error);
    return jsonError("Failed to revoke plan", 500);
  }
}
