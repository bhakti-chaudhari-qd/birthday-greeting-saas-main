import {
  ContactImportJobStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import { normalizeCategoryName } from "@/lib/contacts/categories";
import { listOccasions } from "@/lib/occasions/service";

import { prepareContactImportRow } from "./import-batch";
import { normalizeCsvHeaderKey, type ParsedContactCsvRow } from "./csv";
import {
  IMPORT_BATCH_SIZE,
  IMPORT_LEASE_DURATION_MS,
  IMPORT_TX_OPTIONS,
  IMPORT_UPDATE_CHUNK_SIZE,
} from "./import-constants";
import {
  decodeParsedCache,
  ensureImportJobParsed,
  getRemainingActiveContactSlots,
  storeImportJobErrors,
} from "./import-jobs";

export type ContactImportWorkerSummary = {
  jobsConsidered: number;
  jobsProcessed: number;
  rowsProcessed: number;
  processingIncomplete: boolean;
};

const ACTIVE_JOB_STATUSES: ContactImportJobStatus[] = [
  ContactImportJobStatus.PENDING,
  ContactImportJobStatus.PROCESSING,
];

async function recoverExpiredImportLeases(now: Date) {
  await prisma.contactImportJob.updateMany({
    where: {
      status: ContactImportJobStatus.PROCESSING,
      leaseExpiresAt: { lt: now },
    },
    data: {
      status: ContactImportJobStatus.PENDING,
      claimedAt: null,
      leaseExpiresAt: null,
    },
  });
}

async function claimNextImportJob(now: Date) {
  const candidate = await prisma.contactImportJob.findFirst({
    where: {
      status: { in: ACTIVE_JOB_STATUSES },
      OR: [
        { status: ContactImportJobStatus.PENDING },
        {
          status: ContactImportJobStatus.PROCESSING,
          leaseExpiresAt: { lt: now },
        },
      ],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  if (!candidate) {
    return null;
  }

  const leaseExpiresAt = new Date(now.getTime() + IMPORT_LEASE_DURATION_MS);

  const claimed = await prisma.contactImportJob.updateMany({
    where: {
      id: candidate.id,
      status: { in: ACTIVE_JOB_STATUSES },
    },
    data: {
      status: ContactImportJobStatus.PROCESSING,
      claimedAt: now,
      leaseExpiresAt,
      attemptCount: { increment: 1 },
    },
  });

  if (claimed.count === 0) {
    return null;
  }

  return prisma.contactImportJob.findUnique({
    where: { id: candidate.id },
  });
}

async function resolveCategoryIds(
  organizationId: string,
  categoryNames: string[],
  tx: Prisma.TransactionClient,
): Promise<Map<string, string>> {
  const normalizedNames = [
    ...new Set(
      categoryNames
        .map((name) => normalizeCategoryName(name))
        .filter((name) => name.length > 0),
    ),
  ];

  const map = new Map<string, string>();
  if (normalizedNames.length === 0) {
    return map;
  }

  const existing = await tx.contactCategoryDefinition.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });

  for (const category of existing) {
    map.set(normalizeCategoryName(category.name).toLowerCase(), category.id);
  }

  for (const name of normalizedNames) {
    const key = name.toLowerCase();
    if (map.has(key)) {
      continue;
    }

    if (name.length > 50) {
      continue;
    }

    try {
      const created = await tx.contactCategoryDefinition.create({
        data: { organizationId, name },
        select: { id: true, name: true },
      });
      map.set(key, created.id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await tx.contactCategoryDefinition.findFirst({
          where: {
            organizationId,
            name: { equals: name, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (raced) {
          map.set(key, raced.id);
        }
      }
    }
  }

  return map;
}

async function processImportBatch(
  organizationId: string,
  rows: ParsedContactCsvRow[],
  options: {
    seenMobiles: Set<string>;
    remainingActiveSlots: number;
  },
): Promise<{
  created: number;
  updated: number;
  skippedDuplicate: number;
  skippedLimit: number;
  invalid: number;
  errors: Array<{ row: number; message: string }>;
  remainingActiveSlots: number;
  limitReached: boolean;
}> {
  const errors: Array<{ row: number; message: string }> = [];
  let skippedDuplicate = 0;
  let skippedLimit = 0;
  let invalid = 0;
  let updated = 0;
  let remainingActiveSlots = options.remainingActiveSlots;
  let limitReached = false;

  const preparedRows: Array<{
    rowNumber: number;
    data: Extract<
      ReturnType<typeof prepareContactImportRow>,
      { ok: true }
    >["data"];
  }> = [];

  for (const row of rows) {
    const prepared = prepareContactImportRow(row.rowNumber, row.input);
    if (!prepared.ok) {
      invalid += 1;
      errors.push({ row: prepared.rowNumber, message: prepared.message });
      continue;
    }

    if (options.seenMobiles.has(prepared.data.mobile)) {
      skippedDuplicate += 1;
      errors.push({
        row: prepared.rowNumber,
        message: "Duplicate mobile in this file",
      });
      continue;
    }

    preparedRows.push({
      rowNumber: prepared.rowNumber,
      data: prepared.data,
    });
    options.seenMobiles.add(prepared.data.mobile);
  }

  const mobiles = preparedRows.map((row) => row.data.mobile);
  const existingByMobile =
    mobiles.length > 0
      ? new Map(
          (
            await prisma.contact.findMany({
              where: {
                organizationId,
                mobile: { in: mobiles },
              },
              select: { id: true, mobile: true, isActive: true },
            })
          ).map((contact) => [contact.mobile, contact] as const),
        )
      : new Map<string, { id: string; mobile: string; isActive: boolean }>();

  const toInsert: Array<{
    rowNumber: number;
    data: Prisma.ContactCreateManyInput;
    occasionDates: (typeof preparedRows)[number]["data"]["occasionDates"];
  }> = [];
  const toUpdate: Array<{
    id: string;
    data: Prisma.ContactUncheckedUpdateInput;
    occasionDates: (typeof preparedRows)[number]["data"]["occasionDates"];
  }> = [];
  const categoryNames = preparedRows
    .map((row) => row.data.categoryName)
    .filter((name): name is string => Boolean(name));

  // Categories/occasions first (short tx), then updates in chunks, then createMany.
  // One interactive tx of ~1000 updates exceeds Prisma's default 5s timeout on re-import.
  const occasions = await listOccasions(organizationId);
  const categoryMap =
    await prisma.$transaction(async (tx) => {
      return resolveCategoryIds(
        organizationId,
        categoryNames,
        tx,
      );
    }, IMPORT_TX_OPTIONS);
  const occasionIdByKey = new Map(
    occasions.map((occasion) => [normalizeCsvHeaderKey(occasion.name), occasion.id]),
  );

  for (const row of preparedRows) {
    const existing = existingByMobile.get(row.data.mobile);

    let categoryId: string | null = null;
    if (row.data.categoryName) {
      const key = normalizeCategoryName(row.data.categoryName).toLowerCase();
      categoryId = categoryMap.get(key) ?? null;
    }

    if (existing) {
      const activating = row.data.isActive && !existing.isActive;
      const deactivating = !row.data.isActive && existing.isActive;

      if (activating) {
        if (limitReached || remainingActiveSlots <= 0) {
          limitReached = true;
          skippedLimit += 1;
          errors.push({
            row: row.rowNumber,
            message: "Skipped because contact limit was reached",
          });
          continue;
        }
      }

      toUpdate.push({
        id: existing.id,
        data: {
          name: row.data.name,
          email: row.data.email,
          categoryId,
          address: row.data.address,
          note: row.data.note,
          attributes: row.data.attributes as Prisma.InputJsonObject,
          isActive: row.data.isActive,
        },
        occasionDates: row.data.occasionDates,
      });

      updated += 1;
      if (activating) {
        remainingActiveSlots -= 1;
      } else if (deactivating) {
        remainingActiveSlots += 1;
      }
      continue;
    }

    if (row.data.isActive && limitReached) {
      skippedLimit += 1;
      errors.push({
        row: row.rowNumber,
        message: "Skipped because contact limit was reached",
      });
      continue;
    }

    if (row.data.isActive && remainingActiveSlots <= 0) {
      limitReached = true;
      skippedLimit += 1;
      errors.push({
        row: row.rowNumber,
        message: "Skipped because contact limit was reached",
      });
      continue;
    }

    toInsert.push({
      rowNumber: row.rowNumber,
      data: {
        organizationId,
        name: row.data.name,
        mobile: row.data.mobile,
        email: row.data.email,
        categoryId,
        address: row.data.address,
        note: row.data.note,
        attributes: row.data.attributes as Prisma.InputJsonObject,
        isActive: row.data.isActive,
      },
      occasionDates: row.data.occasionDates,
    });

    if (row.data.isActive) {
      remainingActiveSlots -= 1;
    }
  }

  for (let i = 0; i < toUpdate.length; i += IMPORT_UPDATE_CHUNK_SIZE) {
    const chunk = toUpdate.slice(i, i + IMPORT_UPDATE_CHUNK_SIZE);
    await prisma.$transaction(async (tx) => {
      for (const item of chunk) {
        await tx.contact.update({
          where: { id: item.id },
          data: item.data,
        });

        for (const [occasionKey, occasionDate] of Object.entries(item.occasionDates)) {
          const occasionId = occasionIdByKey.get(normalizeCsvHeaderKey(occasionKey));
          if (!occasionId) {
            continue;
          }
          await tx.contactOccasionDate.upsert({
            where: {
              contactId_occasionId: {
                contactId: item.id,
                occasionId,
              },
            },
            create: {
              organizationId,
              contactId: item.id,
              occasionId,
              date: occasionDate.date,
              month: occasionDate.month,
              day: occasionDate.day,
            },
            update: {
              date: occasionDate.date,
              month: occasionDate.month,
              day: occasionDate.day,
            },
          });
        }
      }
    }, IMPORT_TX_OPTIONS);
  }

  if (toInsert.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.contact.createMany({
        data: toInsert.map((item) => item.data),
        skipDuplicates: true,
      });

      const insertedMobiles = toInsert.map((item) => item.data.mobile);
      const insertedContacts = await tx.contact.findMany({
        where: { organizationId, mobile: { in: insertedMobiles } },
        select: { id: true, mobile: true },
      });
      const idByMobile = new Map(
        insertedContacts.map((contact) => [contact.mobile, contact.id] as const),
      );

      const occasionDateRows: Prisma.ContactOccasionDateCreateManyInput[] = [];
      for (const item of toInsert) {
        const contactId = idByMobile.get(item.data.mobile as string);
        if (!contactId) {
          continue;
        }
        for (const [occasionKey, occasionDate] of Object.entries(item.occasionDates)) {
          const occasionId = occasionIdByKey.get(normalizeCsvHeaderKey(occasionKey));
          if (!occasionId) {
            continue;
          }
          occasionDateRows.push({
            organizationId,
            contactId,
            occasionId,
            date: occasionDate.date,
            month: occasionDate.month,
            day: occasionDate.day,
          });
        }
      }

      if (occasionDateRows.length > 0) {
        await tx.contactOccasionDate.createMany({
          data: occasionDateRows,
          skipDuplicates: true,
        });
      }
    }, IMPORT_TX_OPTIONS);
  }

  return {
    created: toInsert.length,
    updated,
    skippedDuplicate,
    skippedLimit,
    invalid,
    errors,
    remainingActiveSlots,
    limitReached,
  };
}

async function processImportJob(jobId: string): Promise<{
  rowsProcessed: number;
  processingIncomplete: boolean;
}> {
  const job = await prisma.contactImportJob.findUnique({
    where: { id: jobId },
  });

  if (!job || job.status === ContactImportJobStatus.CANCELLED) {
    return { rowsProcessed: 0, processingIncomplete: false };
  }

  const { totalRows } = await ensureImportJobParsed(jobId);
  const refreshed = await prisma.contactImportJob.findUnique({
    where: { id: jobId },
  });

  if (!refreshed?.parsedCache) {
    throw new Error("Import job parse cache missing");
  }

  const parsedRows = decodeParsedCache(Buffer.from(refreshed.parsedCache)).rows;
  const effectiveTotalRows = refreshed.totalRows || totalRows;

  const startIndex = job.nextRowIndex;
  if (startIndex >= effectiveTotalRows) {
    await prisma.contactImportJob.update({
      where: { id: jobId },
      data: {
        status: ContactImportJobStatus.COMPLETED,
        completedAt: new Date(),
        leaseExpiresAt: null,
        claimedAt: null,
        parsedCache: null,
        fileBytes: new Uint8Array(0),
      },
    });
    return { rowsProcessed: 0, processingIncomplete: false };
  }

  const batchRows = parsedRows.slice(startIndex, startIndex + IMPORT_BATCH_SIZE);
  const seenMobiles = new Set<string>();
  const remainingActiveSlots = await getRemainingActiveContactSlots(
    job.organizationId,
  );

  const batchResult = await processImportBatch(job.organizationId, batchRows, {
    seenMobiles,
    remainingActiveSlots,
  });

  await storeImportJobErrors(jobId, batchResult.errors);

  const processedRows = startIndex + batchRows.length;
  const nextRowIndex = processedRows;
  const isComplete = nextRowIndex >= effectiveTotalRows;

  await prisma.contactImportJob.update({
    where: { id: jobId },
    data: {
      processedRows,
      nextRowIndex,
      created: { increment: batchResult.created },
      updated: { increment: batchResult.updated },
      skippedDuplicate: { increment: batchResult.skippedDuplicate },
      skippedLimit: { increment: batchResult.skippedLimit },
      invalid: { increment: batchResult.invalid },
      status: isComplete
        ? ContactImportJobStatus.COMPLETED
        : ContactImportJobStatus.PENDING,
      completedAt: isComplete ? new Date() : null,
      leaseExpiresAt: null,
      claimedAt: null,
      ...(isComplete
        ? {
            parsedCache: null,
            fileBytes: new Uint8Array(0),
          }
        : {}),
    },
  });

  console.info("Contact import worker batch", {
    jobId,
    organizationId: job.organizationId,
    processedRows,
    totalRows: effectiveTotalRows,
    batchCreated: batchResult.created,
    batchUpdated: batchResult.updated,
    processingIncomplete: !isComplete,
  });

  return {
    rowsProcessed: batchRows.length,
    processingIncomplete: !isComplete,
  };
}

export async function runContactImportWorker(): Promise<ContactImportWorkerSummary> {
  const now = new Date();
  await recoverExpiredImportLeases(now);

  const pendingCount = await prisma.contactImportJob.count({
    where: {
      status: { in: ACTIVE_JOB_STATUSES },
    },
  });

  const summary: ContactImportWorkerSummary = {
    jobsConsidered: pendingCount,
    jobsProcessed: 0,
    rowsProcessed: 0,
    processingIncomplete: false,
  };

  const job = await claimNextImportJob(now);
  if (!job) {
    return summary;
  }

  try {
    const result = await processImportJob(job.id);
    summary.jobsProcessed = 1;
    summary.rowsProcessed = result.rowsProcessed;
    summary.processingIncomplete = result.processingIncomplete;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Contact import worker failed";

    await prisma.contactImportJob.update({
      where: { id: job.id },
      data: {
        status: ContactImportJobStatus.FAILED,
        errorMessage: message,
        completedAt: new Date(),
        leaseExpiresAt: null,
        claimedAt: null,
      },
    });

    console.error("Contact import worker failed", {
      jobId: job.id,
      organizationId: job.organizationId,
      error: message,
    });
  }

  const remaining = await prisma.contactImportJob.count({
    where: {
      status: { in: ACTIVE_JOB_STATUSES },
    },
  });
  summary.processingIncomplete ||= remaining > 0;

  return summary;
}
