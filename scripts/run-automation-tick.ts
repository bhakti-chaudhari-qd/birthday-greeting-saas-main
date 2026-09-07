/**
 * Local development helper: one automation cycle (generate + drain), then exit.
 *
 * Runs the same generation used by POST /api/v1/internal/cron/tick (once per
 * active occasion), then the same runMessageWorker() as POST
 * /api/v1/internal/worker/drain.
 *
 * Does not require CRON_SECRET (that protects the HTTP routes only).
 * Does not require `next dev` to be running - talks to the database directly.
 */

import { loadLocalEnv } from "./load-local-env";

loadLocalEnv();

const MAX_DRAIN_PASSES = 10;
const MAX_IMPORT_DRAIN_PASSES = 10;

function formatAutomationCounts(
  label: string,
  summary: {
    targetDate: string;
    organizationsConsidered: number;
    organizationsProcessed: number;
    organizationsSkippedIneligible: number;
    organizationsSkippedBeforeSendTime: number;
    organizationsFailed: number;
    totalCreated: number;
    totalSkippedDuplicate: number;
    totalSkippedLimit: number;
    processingIncomplete: boolean;
  },
): string {
  return [
    `${label}`,
    `  targetDate: ${summary.targetDate}`,
    `  organizationsConsidered: ${summary.organizationsConsidered}`,
    `  organizationsProcessed: ${summary.organizationsProcessed}`,
    `  organizationsSkippedIneligible: ${summary.organizationsSkippedIneligible}`,
    `  organizationsSkippedBeforeSendTime: ${summary.organizationsSkippedBeforeSendTime}`,
    `  organizationsFailed: ${summary.organizationsFailed}`,
    `  totalCreated: ${summary.totalCreated}`,
    `  totalSkippedDuplicate: ${summary.totalSkippedDuplicate}`,
    `  totalSkippedLimit: ${summary.totalSkippedLimit}`,
    `  processingIncomplete: ${summary.processingIncomplete}`,
  ].join("\n");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    console.error(
      "automation:tick accepts no arguments. It discovers work from the database only.",
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required. Set it in .env.local or .env.");
    process.exit(1);
  }

  const { prisma } = await import("@/lib/db");
  const { runOccasionAutomation } = await import(
    "@/lib/automation/run-occasion"
  );
  const { formatMessageWorkerSummary } = await import(
    "@/lib/queue/format-worker-summary"
  );
  const { runMessageWorker } = await import("@/lib/queue/worker");
  const { runContactImportWorker } = await import("@/lib/contacts/import-worker");

  try {
    let importPass = 0;
    let importSummary = await runContactImportWorker();
    importPass += 1;
    console.log(
      [
        "Contact import worker",
        `  jobsConsidered: ${importSummary.jobsConsidered}`,
        `  jobsProcessed: ${importSummary.jobsProcessed}`,
        `  rowsProcessed: ${importSummary.rowsProcessed}`,
        `  processingIncomplete: ${importSummary.processingIncomplete}`,
      ].join("\n"),
    );

    while (
      importSummary.processingIncomplete &&
      importPass < MAX_IMPORT_DRAIN_PASSES
    ) {
      importSummary = await runContactImportWorker();
      importPass += 1;
      console.log(`\nImport drain pass ${importPass}`);
      console.log(
        [
          "Contact import worker",
          `  jobsConsidered: ${importSummary.jobsConsidered}`,
          `  jobsProcessed: ${importSummary.jobsProcessed}`,
          `  rowsProcessed: ${importSummary.rowsProcessed}`,
          `  processingIncomplete: ${importSummary.processingIncomplete}`,
        ].join("\n"),
      );
    }

    const occasions = await prisma.occasion.findMany({
      select: { id: true, name: true },
    });

    for (const occasion of occasions) {
      const summary = await runOccasionAutomation(occasion.id);
      console.log(formatAutomationCounts(`${occasion.name} automation`, summary));
    }

    let drainPass = 0;
    let workerSummary = await runMessageWorker();
    drainPass += 1;
    console.log(formatMessageWorkerSummary(workerSummary));

    while (
      workerSummary.processingIncomplete &&
      drainPass < MAX_DRAIN_PASSES
    ) {
      workerSummary = await runMessageWorker();
      drainPass += 1;
      console.log(`\nDrain pass ${drainPass}`);
      console.log(formatMessageWorkerSummary(workerSummary));
    }

    if (workerSummary.processingIncomplete) {
      console.warn(
        `Worker still reports processingIncomplete after ${drainPass} drain passes. Run npm run automation:tick or npm run worker:drain again.`,
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Automation tick failed";
    console.error(message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
