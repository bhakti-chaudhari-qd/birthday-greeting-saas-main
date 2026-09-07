import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import {
  PlatformAdminOrgError,
  activatePlanDealSchema,
  activatePlanForPlatformAdmin,
} from "@/lib/admin/org-ops";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import { ActivePlanRenewalConfirmationRequiredError } from "@/lib/billing/service";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Activates (or renews) a STARTER/PRO/CUSTOM plan deal for this org immediately, without payment. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id } = await context.params;
    const body = await request.json();
    const input = activatePlanDealSchema.parse(body);
    const organization = await activatePlanForPlatformAdmin(
      id,
      input,
      admin.adminId,
    );

    return NextResponse.json({ data: { organization } }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid plan activation request", 400, error.flatten());
    }
    if (error instanceof PlatformAdminOrgError) {
      return jsonError(error.message, 404);
    }
    if (error instanceof ActivePlanRenewalConfirmationRequiredError) {
      return jsonError(error.message, 409);
    }
    console.error("Activate plan deal failed", error);
    return jsonError("Failed to activate deal", 500);
  }
}
