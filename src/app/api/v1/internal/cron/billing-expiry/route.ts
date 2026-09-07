import { NextResponse } from "next/server";

import { CronAuthError, requireCronSecret } from "@/lib/api/cron-auth";
import { jsonError } from "@/lib/api/response";
import { expireOverduePaidSubscriptions } from "@/lib/billing/apply-plan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Marks ACTIVE paid subscriptions past paidUntil as PAST_DUE. */
export async function POST(request: Request) {
  try {
    requireCronSecret(request);
    const summary = await expireOverduePaidSubscriptions();
    return NextResponse.json({ data: summary });
  } catch (error) {
    if (error instanceof CronAuthError) {
      return jsonError(error.message, 401);
    }
    console.error("Billing expiry cron failed", error);
    return jsonError("Billing expiry cron failed", 500);
  }
}

export async function GET(request: Request) {
  return POST(request);
}
