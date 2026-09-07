import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import {
  PlatformAdminOrgError,
  setOrganizationUserActiveForPlatformAdmin,
} from "@/lib/admin/org-ops";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; userId: string }>;
};

const updateUserActiveSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id, userId } = await context.params;
    const body = await request.json();
    const input = updateUserActiveSchema.parse(body);
    const user = await setOrganizationUserActiveForPlatformAdmin({
      actorAdminId: admin.adminId,
      organizationId: id,
      userId,
      isActive: input.isActive,
    });

    return NextResponse.json({ data: { user } });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid user update", 400, error.flatten());
    }

    if (error instanceof PlatformAdminOrgError) {
      return jsonError(error.message, 404);
    }

    console.error("Update organization user for platform admin failed", error);
    return jsonError("Failed to update user", 500);
  }
}
