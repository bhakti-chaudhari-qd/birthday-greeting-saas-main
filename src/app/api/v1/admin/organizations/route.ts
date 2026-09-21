import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import {
  createClientForPlatformAdmin,
  createClientSchema,
} from "@/lib/admin/create-client";
import { listOrganizationsForPlatformAdmin } from "@/lib/admin/organizations";
import { RegistrationError } from "@/lib/auth/register";

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

export async function POST(request: Request) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const input = createClientSchema.parse(await request.json());
    const result = await createClientForPlatformAdmin(input, admin.adminId);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return jsonError(
        "Invalid client details",
        400,
        error instanceof ZodError ? error.flatten() : undefined,
      );
    }
    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.code === "CONFLICT" ? 409 : 400);
    }

    console.error("Create client for platform admin failed", error);
    return jsonError("Failed to create client", 500);
  }
}
