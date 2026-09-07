import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { BillingNotConfiguredError } from "@/lib/billing/razorpay";
import {
  BillingValidationError,
  confirmCheckoutPayment,
  confirmCreditCheckoutPayment,
} from "@/lib/billing/service";
import { billingConfirmSchema } from "@/lib/validation/billing";

export const dynamic = "force-dynamic";

/**
 * Fast path after Razorpay Checkout success. Webhooks remain the durable
 * source of truth; this verifies the payment signature and applies the plan
 * or credit pack.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = billingConfirmSchema.parse(body);

    if (input.packId) {
      const subscription = await confirmCreditCheckoutPayment({
        organizationId: auth.organizationId,
        packId: input.packId,
        orderId: input.orderId!,
        paymentId: input.paymentId,
        signature: input.signature,
      });

      return NextResponse.json({
        data: {
          kind: "CREDITS",
          plan: subscription.plan,
          status: subscription.status,
          bonusMessageCredits: subscription.bonusMessageCredits,
          monthlyMessageLimit: subscription.monthlyMessageLimit,
          effectiveMonthlyMessageLimit:
            subscription.monthlyMessageLimit + subscription.bonusMessageCredits,
          paidUntil: subscription.paidUntil?.toISOString() ?? null,
        },
      });
    }

    const subscription = await confirmCheckoutPayment({
      organizationId: auth.organizationId,
      plan: input.plan!,
      orderId: input.orderId,
      subscriptionId: input.subscriptionId,
      paymentId: input.paymentId,
      signature: input.signature,
    });

    return NextResponse.json({
      data: {
        kind: "PLAN",
        plan: subscription.plan,
        status: subscription.status,
        contactLimit: subscription.contactLimit,
        monthlyMessageLimit: subscription.monthlyMessageLimit,
        bonusMessageCredits: subscription.bonusMessageCredits,
        paidUntil: subscription.paidUntil?.toISOString() ?? null,
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid confirm request", 400, error.flatten());
    }

    if (error instanceof BillingValidationError) {
      return jsonError(error.message, 400);
    }

    if (error instanceof BillingNotConfiguredError) {
      return jsonError(error.message, 503);
    }

    console.error("Confirm billing checkout failed", error);
    return jsonError("Failed to confirm payment", 500);
  }
}
