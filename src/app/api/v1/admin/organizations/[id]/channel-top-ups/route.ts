import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import {
  PlatformAdminOrgError,
  topUpCustomPlanChannelForPlatformAdmin,
  topUpCustomPlanChannelSchema,
} from "@/lib/admin/org-ops";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import { PlanLedgerError } from "@/lib/billing/plan-ledger";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Increases one channel's ceiling for this org's current CUSTOM period. Not a renewal. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id } = await context.params;
    const body = await request.json();
    const input = topUpCustomPlanChannelSchema.parse(body);
    const organization = await topUpCustomPlanChannelForPlatformAdmin(
      id,
      input,
      admin.adminId,
    );

    return NextResponse.json({ data: { organization } }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid top-up request", 400, error.flatten());
    }
    if (error instanceof PlatformAdminOrgError) {
      return jsonError(error.message, 404);
    }
    if (error instanceof PlanLedgerError) {
      return jsonError(error.message, 400);
    }
    console.error("Top up CUSTOM plan channel failed", error);
    return jsonError("Failed to add channel capacity", 500);
  }
}
