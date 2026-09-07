/**
 * Local scale smoke: enqueue a synthetic CSV import and drain until complete.
 *
 * Usage:
 *   npx tsx scripts/smoke-contact-import.ts [rowCount]
 *
 * Defaults to 2500 rows. Requires DATABASE_URL. Does not need CRON_SECRET.
 * Always cleans up the temporary organization (even on failure).
 *
 * Optional env:
 *   SMOKE_MIN_ROWS_PER_SEC=50   fail if slower than this (0 disables)
 *   SMOKE_MAX_HEAP_MB=2048      warn (does not fail) if heap exceeds this
 */

import { ContactImportFileFormat } from "@prisma/client";

import { loadLocalEnv } from "./load-local-env";

loadLocalEnv();

function heapMb(): number {
  return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
}

function rssMb(): number {
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

async function main() {
  const rowCount = Number.parseInt(process.argv[2] ?? "2500", 10);
  if (!Number.isFinite(rowCount) || rowCount < 1) {
    console.error("rowCount must be a positive integer");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const minRowsPerSec = Number.parseFloat(
    process.env.SMOKE_MIN_ROWS_PER_SEC ?? "0",
  );
  const maxHeapMb = Number.parseInt(process.env.SMOKE_MAX_HEAP_MB ?? "2048", 10);
  const maxPasses = Math.max(50, Math.ceil(rowCount / 1000) + 50);

  const { prisma } = await import("@/lib/db");
  const { createRegisteredOrganization } = await import("@/lib/auth/register");
  const { enqueueContactImportJob } = await import("@/lib/contacts/import-jobs");
  const { runContactImportWorker } = await import(
    "@/lib/contacts/import-worker"
  );
  const { uniqueIndianMobile, uniqueSuffix } = await import("../tests/helpers");

  const suffix = uniqueSuffix();
  let organizationId: string | null = null;
  let peakHeapMb = heapMb();
  let peakRssMb = rssMb();

  const noteMemory = () => {
    peakHeapMb = Math.max(peakHeapMb, heapMb());
    peakRssMb = Math.max(peakRssMb, rssMb());
  };

  try {
    console.log(
      JSON.stringify({
        phase: "start",
        rowCount,
        maxPasses,
        heapMb: heapMb(),
        rssMb: rssMb(),
      }),
    );

    const org = await createRegisteredOrganization({
      organizationName: `Smoke Import ${suffix}`,
      organizationSlug: `smoke-import-${suffix}`,
      timezone: "UTC",
      adminName: "Smoke Admin",
      email: `smoke-import-${suffix}@test.local`,
      password: "password12345",
    });
    organizationId = org.organization.id;

    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: { contactLimit: Math.max(rowCount + 10, 1_000) },
    });

    const buildStarted = Date.now();
    const lines = ["name,mobile"];
    for (let i = 0; i < rowCount; i += 1) {
      lines.push(`Smoke ${i},${uniqueIndianMobile()}`);
    }
    const csv = lines.join("\n");
    const csvBytes = Buffer.byteLength(csv, "utf8");
    noteMemory();
    console.log(
      JSON.stringify({
        phase: "csv_built",
        rowCount,
        csvBytes,
        csvMb: Number((csvBytes / 1024 / 1024).toFixed(2)),
        buildMs: Date.now() - buildStarted,
        heapMb: heapMb(),
        rssMb: rssMb(),
      }),
    );

    console.log(`Enqueueing ${rowCount} rows for org ${org.organization.id}`);
    const started = Date.now();

    const job = await enqueueContactImportJob({
      organizationId: org.organization.id,
      createdByUserId: org.user.id,
      fileName: "smoke.csv",
      fileFormat: ContactImportFileFormat.CSV,
      fileBytes: Buffer.from(csv, "utf8"),
    });
    noteMemory();

    let passes = 0;
    let summary = await runContactImportWorker();
    passes += 1;
    noteMemory();

    while (summary.processingIncomplete && passes < maxPasses) {
      summary = await runContactImportWorker();
      passes += 1;
      noteMemory();
      if (passes % 10 === 0 || !summary.processingIncomplete) {
        const mid = await prisma.contactImportJob.findUniqueOrThrow({
          where: { id: job.id },
        });
        const elapsed = Date.now() - started;
        console.log(
          JSON.stringify({
            phase: "progress",
            pass: passes,
            processed: mid.processedRows,
            total: mid.totalRows,
            created: mid.created,
            elapsedMs: elapsed,
            rowsPerSecond:
              mid.processedRows > 0
                ? Number((mid.processedRows / (elapsed / 1000)).toFixed(1))
                : 0,
            heapMb: heapMb(),
            rssMb: rssMb(),
          }),
        );
      }
    }

    const done = await prisma.contactImportJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    const elapsedMs = Date.now() - started;
    const contactCount = await prisma.contact.count({
      where: { organizationId: org.organization.id },
    });
    const rowsPerSecond =
      done.processedRows > 0
        ? Number((done.processedRows / (elapsedMs / 1000)).toFixed(1))
        : 0;

    noteMemory();

    const result = {
      phase: "done",
      jobId: done.id,
      status: done.status,
      created: done.created,
      skippedDuplicate: done.skippedDuplicate,
      updated: done.updated,
      skippedLimit: done.skippedLimit,
      invalid: done.invalid,
      contactCount,
      expectedCreated: rowCount,
      passes,
      maxPasses,
      elapsedMs,
      rowsPerSecond,
      peakHeapMb,
      peakRssMb,
      csvMb: Number((csvBytes / 1024 / 1024).toFixed(2)),
      heapWarn: peakHeapMb > maxHeapMb,
      tooSlow:
        minRowsPerSec > 0 &&
        done.status === "COMPLETED" &&
        rowsPerSecond < minRowsPerSec,
      incomplete: summary.processingIncomplete,
    };

    console.log(JSON.stringify(result, null, 2));

    const ok =
      done.status === "COMPLETED" &&
      done.created === rowCount &&
      !result.tooSlow &&
      !result.incomplete;

    if (!ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        phase: "error",
        message: error instanceof Error ? error.message : String(error),
        heapMb: heapMb(),
        rssMb: rssMb(),
        peakHeapMb,
        peakRssMb,
      }),
    );
    process.exitCode = 1;
  } finally {
    if (organizationId) {
      try {
        await prisma.organization.delete({ where: { id: organizationId } });
        console.log(
          JSON.stringify({ phase: "cleanup", organizationId, ok: true }),
        );
      } catch (cleanupError) {
        console.error(
          JSON.stringify({
            phase: "cleanup",
            organizationId,
            ok: false,
            message:
              cleanupError instanceof Error
                ? cleanupError.message
                : String(cleanupError),
          }),
        );
      }
    }
    await prisma.$disconnect();
  }
}

void main();
