import { after } from "next/server";

import { runContactImportWorker } from "@/lib/contacts/import-worker";

/**
 * Best-effort same-runtime processing after the HTTP response is sent.
 * Production should still call POST /api/v1/internal/cron/contact-import on a cron.
 */
export function scheduleContactImportWorkerProcessing(): void {
  const run = () =>
    runContactImportWorker().catch((error) => {
      console.error("Background contact import worker failed", error);
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
