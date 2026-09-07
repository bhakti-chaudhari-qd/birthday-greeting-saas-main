import { ContactImportFileFormat, ContactImportJobStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST as contactImportCron } from "@/app/api/v1/internal/cron/contact-import/route";
import { createRegisteredOrganization } from "@/lib/auth/register";
import {
  ContactImportJobConflictError,
  cancelContactImportJob,
  enqueueContactImportJob,
} from "@/lib/contacts/import-jobs";
import { IMPORT_BATCH_SIZE } from "@/lib/contacts/import-constants";
import { runContactImportWorker } from "@/lib/contacts/import-worker";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

const previousCronSecret = process.env.CRON_SECRET;

function registerInput(suffix: string) {
  return {
    organizationName: `Import Job Org ${suffix}`,
    organizationSlug: `import-job-${suffix}`,
    timezone: "UTC",
    adminName: "Import Admin",
    email: `import-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

function buildCsv(rows: Array<{ name: string; mobile: string }>) {
  const lines = ["name,mobile"];
  for (const row of rows) {
    lines.push(`${row.name},${row.mobile}`);
  }
  return lines.join("\n");
}

async function drainImportUntilDone(maxPasses = 20) {
  let passes = 0;
  let summary = await runContactImportWorker();
  passes += 1;
  while (summary.processingIncomplete && passes < maxPasses) {
    summary = await runContactImportWorker();
    passes += 1;
  }
  return { summary, passes };
}

describe("async contact import worker", () => {
  beforeAll(async () => {
    process.env.CRON_SECRET = "test-cron-secret-contact-import-drain";
    if (!databaseUrl) {
      return;
    }
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterAll(async () => {
    if (previousCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousCronSecret;
    }
    await prisma.$disconnect();
  });

  it("protects the contact-import cron with CRON_SECRET", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const missing = await contactImportCron(
      new Request("http://localhost/api/v1/internal/cron/contact-import", {
        method: "POST",
      }),
    );
    expect(missing.status).toBe(401);

    const ok = await contactImportCron(
      new Request("http://localhost/api/v1/internal/cron/contact-import", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.data).toMatchObject({
      jobsConsidered: expect.any(Number),
      jobsProcessed: expect.any(Number),
      rowsProcessed: expect.any(Number),
      processingIncomplete: expect.any(Boolean),
    });
  });

  it("enqueues, drains in batches, and completes with correct counts", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: { contactLimit: 5_000 },
    });

    const rowCount = IMPORT_BATCH_SIZE + 50;
    const rows = Array.from({ length: rowCount }, (_, index) => ({
      name: `Person ${index}`,
      mobile: testMobile(),
    }));
    const csv = buildCsv(rows);

    const job = await enqueueContactImportJob({
      organizationId: org.organization.id,
      createdByUserId: org.user.id,
      fileName: "bulk.csv",
      fileFormat: ContactImportFileFormat.CSV,
      fileBytes: Buffer.from(csv, "utf8"),
    });

    expect(job.status).toBe(ContactImportJobStatus.PENDING);

    const first = await runContactImportWorker();
    expect(first.jobsProcessed).toBe(1);
    expect(first.rowsProcessed).toBe(IMPORT_BATCH_SIZE);
    expect(first.processingIncomplete).toBe(true);

    const mid = await prisma.contactImportJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(mid.nextRowIndex).toBe(IMPORT_BATCH_SIZE);
    expect(mid.created).toBe(IMPORT_BATCH_SIZE);
    expect(mid.status).toBe(ContactImportJobStatus.PENDING);

    const { summary } = await drainImportUntilDone();
    expect(summary.processingIncomplete).toBe(false);

    const done = await prisma.contactImportJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(done.status).toBe(ContactImportJobStatus.COMPLETED);
    expect(done.created).toBe(rowCount);
    expect(done.processedRows).toBe(rowCount);
    expect(done.skippedDuplicate).toBe(0);
    expect(Buffer.from(done.fileBytes).byteLength).toBe(0);
    expect(done.parsedCache).toBeNull();

    const contacts = await prisma.contact.count({
      where: { organizationId: org.organization.id },
    });
    expect(contacts).toBe(rowCount);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("updates existing mobiles and stops at contact limit", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: { contactLimit: 2 },
    });

    const existingMobile = testMobile();
    await prisma.contact.create({
      data: {
        organizationId: org.organization.id,
        name: "Existing",
        mobile: existingMobile,
        isActive: true,
      },
    });

    const m1 = testMobile();
    const m2 = testMobile();
    const m3 = testMobile();
    const csv = buildCsv([
      { name: "Dup Updated", mobile: existingMobile },
      { name: "One", mobile: m1 },
      { name: "Two", mobile: m2 },
      { name: "Three", mobile: m3 },
      { name: "DupInFile", mobile: m1 },
    ]);

    const job = await enqueueContactImportJob({
      organizationId: org.organization.id,
      createdByUserId: org.user.id,
      fileName: "limit.csv",
      fileFormat: ContactImportFileFormat.CSV,
      fileBytes: Buffer.from(csv, "utf8"),
    });

    await drainImportUntilDone();

    const done = await prisma.contactImportJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(done.status).toBe(ContactImportJobStatus.COMPLETED);
    expect(done.updated).toBe(1);
    expect(done.created).toBe(1);
    expect(done.skippedDuplicate).toBeGreaterThanOrEqual(1);
    expect(done.skippedLimit).toBeGreaterThanOrEqual(2);

    const existing = await prisma.contact.findFirst({
      where: { organizationId: org.organization.id, mobile: existingMobile },
    });
    expect(existing?.name).toBe("Dup Updated");

    const active = await prisma.contact.count({
      where: { organizationId: org.organization.id, isActive: true },
    });
    expect(active).toBe(2);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("rejects a second concurrent import for the same org", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const csv = buildCsv([{ name: "A", mobile: testMobile() }]);

    await enqueueContactImportJob({
      organizationId: org.organization.id,
      createdByUserId: org.user.id,
      fileName: "first.csv",
      fileFormat: ContactImportFileFormat.CSV,
      fileBytes: Buffer.from(csv, "utf8"),
    });

    await expect(
      enqueueContactImportJob({
        organizationId: org.organization.id,
        createdByUserId: org.user.id,
        fileName: "second.csv",
        fileFormat: ContactImportFileFormat.CSV,
        fileBytes: Buffer.from(csv, "utf8"),
      }),
    ).rejects.toBeInstanceOf(ContactImportJobConflictError);

    await drainImportUntilDone();
    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("cancels an in-progress import and does not keep inserting", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: { contactLimit: 5_000 },
    });

    const rowCount = IMPORT_BATCH_SIZE + 100;
    const rows = Array.from({ length: rowCount }, (_, index) => ({
      name: `Cancel ${index}`,
      mobile: testMobile(),
    }));

    const job = await enqueueContactImportJob({
      organizationId: org.organization.id,
      createdByUserId: org.user.id,
      fileName: "cancel.csv",
      fileFormat: ContactImportFileFormat.CSV,
      fileBytes: Buffer.from(buildCsv(rows), "utf8"),
    });

    await runContactImportWorker();
    const cancelled = await cancelContactImportJob(org.organization.id, job.id);
    expect(cancelled.status).toBe(ContactImportJobStatus.CANCELLED);

    const after = await runContactImportWorker();
    expect(after.jobsProcessed).toBe(0);

    const contacts = await prisma.contact.count({
      where: { organizationId: org.organization.id },
    });
    expect(contacts).toBe(IMPORT_BATCH_SIZE);

    const done = await prisma.contactImportJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(done.status).toBe(ContactImportJobStatus.CANCELLED);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("recovers an expired lease and resumes from nextRowIndex", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: { contactLimit: 5_000 },
    });

    const rowCount = IMPORT_BATCH_SIZE + 20;
    const rows = Array.from({ length: rowCount }, (_, index) => ({
      name: `Lease ${index}`,
      mobile: testMobile(),
    }));

    const job = await enqueueContactImportJob({
      organizationId: org.organization.id,
      createdByUserId: org.user.id,
      fileName: "lease.csv",
      fileFormat: ContactImportFileFormat.CSV,
      fileBytes: Buffer.from(buildCsv(rows), "utf8"),
    });

    await runContactImportWorker();

    await prisma.contactImportJob.update({
      where: { id: job.id },
      data: {
        status: ContactImportJobStatus.PROCESSING,
        leaseExpiresAt: new Date(Date.now() - 60_000),
        claimedAt: new Date(Date.now() - 120_000),
      },
    });

    await drainImportUntilDone();

    const done = await prisma.contactImportJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(done.status).toBe(ContactImportJobStatus.COMPLETED);
    expect(done.created).toBe(rowCount);

    const contacts = await prisma.contact.count({
      where: { organizationId: org.organization.id },
    });
    expect(contacts).toBe(rowCount);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });
});
