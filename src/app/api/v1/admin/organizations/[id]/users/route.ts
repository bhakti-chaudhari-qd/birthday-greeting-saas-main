import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import {
  addOrganizationUserForPlatformAdmin,
  addOrganizationUserSchema,
} from "@/lib/admin/add-organization-user";
import { PlatformAdminOrgError } from "@/lib/admin/org-ops";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import { RegistrationError } from "@/lib/auth/register";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id } = await context.params;
    const input = addOrganizationUserSchema.parse(await request.json());
    const user = await addOrganizationUserForPlatformAdmin(
      input,
      id,
      admin.adminId,
    );

    return NextResponse.json({ data: { user } }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid user details", 400, error.flatten());
    }

    if (error instanceof PlatformAdminOrgError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.code === "CONFLICT" ? 409 : 400);
    }

    console.error("Add organization user for platform admin failed", error);
    return jsonError("Failed to add user", 500);
  }
}
