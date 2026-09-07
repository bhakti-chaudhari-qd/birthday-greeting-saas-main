import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import {
  PlatformAdminOrgError,
  recordPlanPaymentForPlatformAdmin,
  recordPlanPaymentSchema,
} from "@/lib/admin/org-ops";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Records a payment against this org's outstanding CUSTOM-plan balance. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id } = await context.params;
    const body = await request.json();
    const input = recordPlanPaymentSchema.parse(body);
    const organization = await recordPlanPaymentForPlatformAdmin(
      id,
      input,
      admin.adminId,
    );

    return NextResponse.json({ data: { organization } }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid payment request", 400, error.flatten());
    }
    if (error instanceof PlatformAdminOrgError) {
      return jsonError(error.message, 404);
    }
    console.error("Record CUSTOM plan payment failed", error);
    return jsonError("Failed to record payment", 500);
  }
}
