import { NextResponse } from "next/server";

import { CronAuthError, requireCronSecret } from "@/lib/api/cron-auth";
import { jsonError } from "@/lib/api/response";
import { runMessageWorker } from "@/lib/queue/worker";

export const dynamic = "force-dynamic";
/** Provider HTTP + queue claim cycles need headroom on Vercel Pro. */
export const maxDuration = 60;

/**
 * Scheduler-neutral internal worker drain.
 * Auth: Authorization Bearer CRON_SECRET (same fail-closed helper as Birthday cron).
 * Does not accept organizationId, queueIds, concurrency, or batch size from the body.
 */
export async function POST(request: Request) {
  try {
    requireCronSecret(request);

    // Ignore body intentionally - workers discover work from the database only.
    if (request.headers.get("content-length")) {
      try {
        await request.json();
      } catch {
        // Empty/invalid body is fine; parameters are never trusted.
      }
    }

    const summary = await runMessageWorker();

    return NextResponse.json({ data: summary });
  } catch (error) {
    if (error instanceof CronAuthError) {
      return jsonError(error.message, 401);
    }

    console.error("Message worker drain failed", error);
    return jsonError("Failed to drain message worker", 500);
  }
}

/** Vercel Cron invokes schedules with GET + Authorization: Bearer CRON_SECRET. */
export const GET = POST;
