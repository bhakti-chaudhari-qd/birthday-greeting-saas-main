import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import {
  BillingNotConfiguredError,
  requireRazorpayCredentials,
  verifyRazorpayWebhookSignature,
} from "@/lib/billing/razorpay";
import {
  processRazorpayWebhook,
  type RazorpayWebhookPayload,
} from "@/lib/billing/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const credentials = requireRazorpayCredentials();
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (
      !verifyRazorpayWebhookSignature(
        rawBody,
        signature,
        credentials.webhookSecret,
      )
    ) {
      return jsonError("Invalid webhook signature", 400);
    }

    let payload: RazorpayWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
    } catch {
      return jsonError("Invalid webhook JSON", 400);
    }

    const result = await processRazorpayWebhook(payload);
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return jsonError(error.message, 503);
    }

    console.error("Razorpay webhook failed", error);
    return jsonError("Webhook processing failed", 500);
  }
}
