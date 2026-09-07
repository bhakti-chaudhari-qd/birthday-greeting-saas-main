import { NextResponse } from "next/server";

import { CronAuthError, requireCronSecret } from "@/lib/api/cron-auth";
import { jsonError } from "@/lib/api/response";
import { runOccasionAutomation } from "@/lib/automation/run-occasion";
import { runContactImportWorker } from "@/lib/contacts/import-worker";
import { prisma } from "@/lib/db";
import { runMessageWorker } from "@/lib/queue/worker";
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

    const occasions = await prisma.occasion.findMany({
      select: { id: true, name: true },
    });

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
    const drain = await runStep("worker-drain", () => runMessageWorker());
    const billingExpiry = await runStep("billing-expiry", () =>
      expireOverduePaidSubscriptions(),
    );

    const steps = {
      occasions: occasionSteps,
      contactImport,
      drain,
      billingExpiry,
    };
    const failed =
      Object.values(occasionSteps).some((step) => !step.ok) ||
      !contactImport.ok ||
      !drain.ok ||
      !billingExpiry.ok;

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
