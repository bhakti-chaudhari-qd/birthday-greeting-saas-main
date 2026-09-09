import { NextResponse } from "next/server";

import { CronAuthError, requireCronSecret } from "@/lib/api/cron-auth";
import { jsonError } from "@/lib/api/response";
import { runBirthdayAutomation } from "@/lib/automation/birthday";

export const dynamic = "force-dynamic";
/** Allow longer runs for large tenants on Vercel Pro. */
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    requireCronSecret(request);
    const summary = await runBirthdayAutomation();

    return NextResponse.json({ data: summary });
  } catch (error) {
    if (error instanceof CronAuthError) {
      return jsonError(error.message, 401);
    }

    console.error("Birthday automation cron failed", error);
    return jsonError("Failed to run birthday automation", 500);
  }
}

/** Vercel Cron invokes schedules with GET + Authorization: Bearer CRON_SECRET. */
export const GET = POST;
