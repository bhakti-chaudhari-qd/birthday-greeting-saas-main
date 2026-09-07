import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import {
  PLATFORM_ADMIN_AUDIT_ACTIONS,
  createPlatformAdminAuditEvent,
} from "@/lib/admin/audit";
import { PlatformAdminOrgError } from "@/lib/admin/org-ops";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import {
  BillingNotConfiguredError,
  RazorpayApiError,
} from "@/lib/billing/razorpay";
import {
  BillingValidationError,
  cancelAdminPaymentLink,
} from "@/lib/billing/service";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; checkoutId: string }>;
};

/** Cancels a single outstanding (CREATED) payment link for this org. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id, checkoutId } = await context.params;
    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!organization) {
      throw new PlatformAdminOrgError("Organization not found");
    }

    await cancelAdminPaymentLink(id, checkoutId);

    await createPlatformAdminAuditEvent({
      actorAdminId: admin.adminId,
      organizationId: id,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.PAYMENT_LINK_CANCELLED,
      targetType: "organization",
      targetId: id,
      metadata: { checkoutId },
    });

    return NextResponse.json({ data: { cancelled: true } });
  } catch (error) {
    if (error instanceof PlatformAdminOrgError) {
      return jsonError(error.message, 404);
    }
    if (error instanceof BillingValidationError) {
      return jsonError(error.message, 400);
    }
    if (error instanceof BillingNotConfiguredError) {
      return jsonError(error.message, 503);
    }
    if (error instanceof RazorpayApiError) {
      return jsonError(error.message, 502);
    }
    console.error("Cancel admin payment link failed", error);
    return jsonError("Failed to cancel payment link", 500);
  }
}
