import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import {
  PlanCatalogueOpsError,
  updatePlanCatalogueEntryForPlatformAdmin,
  updatePlanCatalogueEntrySchema,
} from "@/lib/admin/plan-catalogue-ops";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ plan: string }>;
};

/** Edits STARTER/PRO catalogue defaults for future checkouts/signups only. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { plan } = await context.params;
    const body = await request.json();
    const input = updatePlanCatalogueEntrySchema.parse(body);
    const entries = await updatePlanCatalogueEntryForPlatformAdmin(
      plan,
      input,
      admin.adminId,
    );

    return NextResponse.json({ data: { entries } });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid plan catalogue update", 400, error.flatten());
    }
    if (error instanceof PlanCatalogueOpsError) {
      return jsonError(error.message, 400);
    }
    console.error("Update plan catalogue entry failed", error);
    return jsonError("Failed to update plan catalogue entry", 500);
  }
}
