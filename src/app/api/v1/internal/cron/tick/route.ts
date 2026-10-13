import { NextResponse } from "next/server";

import { CronAuthError, requireCronSecret } from "@/lib/api/cron-auth";
import { jsonError } from "@/lib/api/response";
import {
  listOccasionsWithEnabledAutomation,
  runOccasionAutomation,
} from "@/lib/automation/run-occasion";
import { withCronTickLock } from "@/lib/automation/tick-lock";
import { runContactImportWorker } from "@/lib/contacts/import-worker";
import { runDailySummaries } from "@/lib/daily-summary/service";
import { drainMessageWorker } from "@/lib/queue/worker";
import { expireOverduePaidSubscriptions } from "@/lib/billing/apply-plan";

export const dynamic = "force-dynamic";
/** Full tick: generate automation + drain imports/messages. */
export const maxDuration = 60;

type StepResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

async function runStep(
  name: string,
  fn: () => Promise<unknown>,
): Promise<StepResult> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Failed to run ${name}`;
    console.error(`Cron tick step failed: ${name}`, error);
    return { ok: false, error: message };
  }
}

/**
 * Single external-scheduler entrypoint (cron-job.org, etc.).
 * Runs generation for every active occasion first, then import + message drains.
 * Auth: Authorization Bearer CRON_SECRET.
 */
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

    // The scheduler fires every minute; never stack a tick on a running one.
    const tick = await withCronTickLock(async () => {
      const occasions = await listOccasionsWithEnabledAutomation();

      const occasionSteps: Record<string, StepResult> = {};
      for (const occasion of occasions) {
        occasionSteps[occasion.id] = await runStep(
          `occasion-automation:${occasion.name}`,
          () => runOccasionAutomation(occasion.id),
        );
      }

      const contactImport = await runStep("contact-import", () =>
        runContactImportWorker(),
      );
      const drain = await runStep("worker-drain", () => drainMessageWorker());
      const billingExpiry = await runStep("billing-expiry", () =>
        expireOverduePaidSubscriptions(),
      );

      const dailySummary = await runStep("daily-summary", () =>
        runDailySummaries(),
      );

      return { occasionSteps, contactImport, drain, billingExpiry, dailySummary };
    });

    if (!tick.acquired) {
      return NextResponse.json({
        data: { skipped: "A previous cron tick is still running" },
      });
    }

    const { occasionSteps, contactImport, drain, billingExpiry, dailySummary } =
      tick.value;

    const steps = {
      occasions: occasionSteps,
      contactImport,
      drain,
      billingExpiry,
      dailySummary,
    };
    const failed =
      Object.values(occasionSteps).some((step) => !step.ok) ||
      !contactImport.ok ||
      !drain.ok ||
      !billingExpiry.ok ||
      !dailySummary.ok;

    return NextResponse.json(
      { data: { steps } },
      { status: failed ? 207 : 200 },
    );
  } catch (error) {
    if (error instanceof CronAuthError) {
      return jsonError(error.message, 401);
    }

    console.error("Cron tick failed", error);
    return jsonError("Failed to run cron tick", 500);
  }
}

/** Schedulers that only support GET can use the same handler. */
export const GET = POST;
