import { NextResponse } from "next/server";

import { CronAuthError, requireCronSecret } from "@/lib/api/cron-auth";
import { jsonError } from "@/lib/api/response";
import { runContactImportWorker } from "@/lib/contacts/import-worker";

export const dynamic = "force-dynamic";
/** Large CSV/Excel imports may need the full Pro function window. */
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    requireCronSecret(request);

    if (request.headers.get("content-length")) {
      try {
        await request.json();
      } catch {
        // Empty/invalid body is fine.
      }
    }

    const summary = await runContactImportWorker();

    return NextResponse.json({ data: summary });
  } catch (error) {
    if (error instanceof CronAuthError) {
      return jsonError(error.message, 401);
    }

    console.error("Contact import worker drain failed", error);
    return jsonError("Failed to drain contact import worker", 500);
  }
}

/** Vercel Cron invokes schedules with GET + Authorization: Bearer CRON_SECRET. */
export const GET = POST;
