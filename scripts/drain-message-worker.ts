/**
 * Local development helper: process one worker cycle and exit.
 *
 * Calls the same runMessageWorker() used by POST /api/v1/internal/worker/drain.
 * Does not accept org/queue/concurrency parameters - work is discovered from the DB.
 * Does not require CRON_SECRET (that protects the HTTP drain route only).
 */

import { loadLocalEnv } from "./load-local-env";

// Load .env.local / .env before importing Prisma-backed modules.
loadLocalEnv();

async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    console.error(
      "worker:drain accepts no arguments. It discovers work from the database only.",
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required. Set it in .env.local or .env.");
    process.exit(1);
  }

  const { prisma } = await import("@/lib/db");
  const { formatMessageWorkerSummary } = await import(
    "@/lib/queue/format-worker-summary"
  );
  const { runMessageWorker } = await import("@/lib/queue/worker");

  try {
    const summary = await runMessageWorker();
    console.log(formatMessageWorkerSummary(summary));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Message worker drain failed";
    console.error(message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
