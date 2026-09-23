import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import { PlatformAdminOrgError } from "@/lib/admin/org-ops";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import { listContactCategories } from "@/lib/contacts/categories";
import { prisma } from "@/lib/db";

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
    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!organization) {
      throw new PlatformAdminOrgError("Client not found");
    }

    const categories = await listContactCategories(id);

    return NextResponse.json({ data: categories });
  } catch (error) {
    if (error instanceof PlatformAdminOrgError) {
      return jsonError(error.message, 404);
    }

    console.error("List client categories for platform admin failed", error);
    return jsonError("Failed to list categories", 500);
  }
}
