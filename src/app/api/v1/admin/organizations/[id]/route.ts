import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import {
  PlatformAdminOrgDeleteError,
  PlatformAdminOrgError,
  deleteOrganizationForPlatformAdmin,
  deletePlatformOrganizationSchema,
  getOrganizationForPlatformAdmin,
  updateOrganizationForPlatformAdmin,
  updatePlatformOrganizationSchema,
} from "@/lib/admin/org-ops";
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
    const organization = await getOrganizationForPlatformAdmin(id);
    if (!organization) {
      return jsonError("Organization not found", 404);
    }

    return NextResponse.json({ data: { organization } });
  } catch (error) {
    console.error("Get organization for platform admin failed", error);
    return jsonError("Failed to load organization", 500);
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
    const input = updatePlatformOrganizationSchema.parse(body);
    const organization = await updateOrganizationForPlatformAdmin(
      id,
      input,
      admin.adminId,
    );

    return NextResponse.json({ data: { organization } });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid organization update", 400, error.flatten());
    }

    if (error instanceof PlatformAdminOrgError) {
      return jsonError(error.message, 404);
    }

    console.error("Update organization for platform admin failed", error);
    return jsonError("Failed to update organization", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id } = await context.params;
    const body = await request.json();
    const input = deletePlatformOrganizationSchema.parse(body);
    await deleteOrganizationForPlatformAdmin(id, input, admin.adminId);

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid client delete request", 400, error.flatten());
    }

    if (error instanceof PlatformAdminOrgDeleteError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof PlatformAdminOrgError) {
      return jsonError(error.message, 404);
    }

    console.error("Delete organization for platform admin failed", error);
    return jsonError("Failed to delete client", 500);
  }
}
