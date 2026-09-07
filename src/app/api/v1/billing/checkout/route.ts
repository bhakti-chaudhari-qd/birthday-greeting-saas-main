import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  BillingNotConfiguredError,
  RazorpayApiError,
} from "@/lib/billing/razorpay";
import {
  BillingValidationError,
  createCheckoutOrder,
  createCreditCheckoutOrder,
} from "@/lib/billing/service";
import { billingCheckoutSchema } from "@/lib/validation/billing";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = billingCheckoutSchema.parse(body);

    const order = input.packId
      ? await createCreditCheckoutOrder({
          organizationId: auth.organizationId,
          packId: input.packId,
        })
      : await createCheckoutOrder({
          organizationId: auth.organizationId,
          plan: input.plan!,
        });

    return NextResponse.json({ data: order });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid checkout request", 400, error.flatten());
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

    console.error("Create billing checkout failed", error);
    return jsonError("Failed to create checkout order", 500);
  }
}
