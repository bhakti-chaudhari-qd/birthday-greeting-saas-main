import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import {
  PLATFORM_ADMIN_AUDIT_ACTIONS,
  createPlatformAdminAuditEvent,
} from "@/lib/admin/audit";
import {
  editPlanDealForPlatformAdmin,
  editPlanDealSchema,
} from "@/lib/admin/org-ops";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import { PlanLedgerError } from "@/lib/billing/plan-ledger";
import {
  BillingNotConfiguredError,
  RazorpayApiError,
} from "@/lib/billing/razorpay";
import {
  BillingValidationError,
  createDealBalancePaymentLink,
} from "@/lib/billing/service";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; dealId: string }>;
};

/**
 * Edits the org's current plan deal; the change applies to access now. With
 * charge=true it also creates a payment link for what the deal still owes.
 * The edit is kept even if the link fails; paymentLinkError says why.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id, dealId } = await context.params;
    const input = editPlanDealSchema.parse(await request.json());
    const deal = await editPlanDealForPlatformAdmin(
      id,
      dealId,
      input,
      admin.adminId,
    );

    let paymentLink: { shortUrl: string; amountPaise: number } | null = null;
    let paymentLinkError: string | null = null;
    if (input.charge) {
      try {
        const link = await createDealBalancePaymentLink({
          organizationId: id,
          dealId,
          customerEmail: input.customerEmail,
        });
        paymentLink = { shortUrl: link.shortUrl, amountPaise: link.amountPaise };
        await createPlatformAdminAuditEvent({
          actorAdminId: admin.adminId,
          organizationId: id,
          action: PLATFORM_ADMIN_AUDIT_ACTIONS.PAYMENT_LINK_CREATED,
          targetType: "organization",
          targetId: id,
          metadata: { dealId, amountPaise: link.amountPaise },
        });
      } catch (error) {
        if (
          error instanceof BillingValidationError ||
          error instanceof BillingNotConfiguredError ||
          error instanceof RazorpayApiError
        ) {
          paymentLinkError = error.message;
        } else {
          console.error("Deal balance payment link failed", error);
          paymentLinkError = "Failed to create payment link";
        }
      }
    }

    return NextResponse.json({
      data: {
        deal: { id: deal.id, amountDuePaise: deal.amountDuePaise },
        paymentLink,
        paymentLinkError,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid deal edit request", 400, error.flatten());
    }
    if (error instanceof PlanLedgerError) {
      return jsonError(error.message, 400);
    }
    console.error("Edit plan deal failed", error);
    return jsonError("Failed to edit deal", 500);
  }
}
