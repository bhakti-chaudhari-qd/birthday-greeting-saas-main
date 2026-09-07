import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import {
  PLATFORM_ADMIN_AUDIT_ACTIONS,
  createPlatformAdminAuditEvent,
} from "@/lib/admin/audit";
import {
  PlatformAdminOrgError,
  createOrganizationPaymentLinkSchema,
} from "@/lib/admin/org-ops";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import {
  BillingNotConfiguredError,
  RazorpayApiError,
} from "@/lib/billing/razorpay";
import {
  ActivePlanRenewalConfirmationRequiredError,
  BillingValidationError,
  createAdminPaymentLink,
} from "@/lib/billing/service";
import { prisma } from "@/lib/db";

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
    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!organization) {
      throw new PlatformAdminOrgError("Organization not found");
    }

    const body = await request.json();
    const input = createOrganizationPaymentLinkSchema.parse(body);
    const link = await createAdminPaymentLink({
      organizationId: id,
      plan: input.plan,
      amountPaise: input.amountPaise,
      contactLimit: input.contactLimit,
      smsMonthlyLimit: input.smsMonthlyLimit,
      whatsappMonthlyLimit: input.whatsappMonthlyLimit,
      emailMonthlyLimit: input.emailMonthlyLimit,
      durationDays: input.durationDays,
      customerEmail: input.customerEmail,
      confirmRenewal: input.confirmRenewal,
    });

    await createPlatformAdminAuditEvent({
      actorAdminId: admin.adminId,
      organizationId: id,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.PAYMENT_LINK_CREATED,
      targetType: "organization",
      targetId: id,
      metadata: {
        amountPaise: link.amountPaise,
        ...(link.supersededCheckoutIds.length > 0
          ? { supersededCheckoutIds: link.supersededCheckoutIds }
          : {}),
      },
    });

    return NextResponse.json({ data: link }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid payment link request", 400, error.flatten());
    }
    if (error instanceof PlatformAdminOrgError) {
      return jsonError(error.message, 404);
    }
    if (error instanceof BillingValidationError) {
      return jsonError(error.message, 400);
    }
    if (error instanceof ActivePlanRenewalConfirmationRequiredError) {
      return jsonError(error.message, 409);
    }
    if (error instanceof BillingNotConfiguredError) {
      return jsonError(error.message, 503);
    }
    if (error instanceof RazorpayApiError) {
      return jsonError(error.message, 502);
    }
    console.error("Create admin payment link failed", error);
    return jsonError("Failed to create payment link", 500);
  }
}
