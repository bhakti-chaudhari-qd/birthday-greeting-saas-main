import { after } from "next/server";

import { runMessageWorker } from "@/lib/queue/worker";

/**
 * Best-effort same-runtime processing after the HTTP response is sent.
 * Production should still call POST /api/v1/internal/worker/drain on a cron.
 *
 * Safe outside a Next request scope (e.g. direct route tests): no-ops instead
 * of throwing, so enqueue semantics stay testable without running the worker.
 */
export function scheduleMessageWorkerProcessing(): void {
  const run = () =>
    runMessageWorker().catch((error) => {
      console.error("Background message worker failed", error);
    });

  try {
    after(run);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("outside a request scope")
    ) {
      return;
    }

    throw error;
  }
}
