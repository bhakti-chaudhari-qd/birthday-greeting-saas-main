import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import { listOrganizationsForPlatformAdmin } from "@/lib/admin/organizations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const organizations = await listOrganizationsForPlatformAdmin();
    return NextResponse.json({ data: { organizations } });
  } catch (error) {
    console.error("List organizations for platform admin failed", error);
    return jsonError("Failed to load organizations", 500);
  }
}
