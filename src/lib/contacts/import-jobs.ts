import { gunzipSync, gzipSync } from "node:zlib";

import {
  ContactImportFileFormat,
  ContactImportJobStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/db";

import {
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_JOB_ERRORS,
  MAX_IMPORT_ROWS_PER_JOB,
} from "./import-constants";
import type { ParseContactCsvResult } from "./csv";
import { parseContactCsv } from "./csv";
import { parseContactExcel } from "./excel";
import {
  parseStoredImportFieldMappings,
  resolveImportFieldMappings,
} from "./import-field-mappings";
import { ContactValidationError } from "./errors";

export type SerializedImportJob = {
  id: string;
  organizationId: string;
  fileName: string;
  fileFormat: ContactImportFileFormat;
  status: ContactImportJobStatus;
  totalRows: number;
  processedRows: number;
  created: number;
  updated: number;
  skippedDuplicate: number;
  skippedLimit: number;
  invalid: number;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export class ContactImportJobConflictError extends Error {
  constructor(message = "An import is already in progress for this organization") {
    super(message);
    this.name = "ContactImportJobConflictError";
  }
}

export class ContactImportJobNotFoundError extends Error {
  constructor() {
    super("Import job not found");
    this.name = "ContactImportJobNotFoundError";
  }
}

function serializeJob(job: {
  id: string;
  organizationId: string;
  fileName: string;
  fileFormat: ContactImportFileFormat;
  status: ContactImportJobStatus;
  totalRows: number;
  processedRows: number;
  created: number;
  updated: number;
  skippedDuplicate: number;
  skippedLimit: number;
  invalid: number;
  errorMessage: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SerializedImportJob {
  return {
    id: job.id,
    organizationId: job.organizationId,
    fileName: job.fileName,
    fileFormat: job.fileFormat,
    status: job.status,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    created: job.created,
    updated: job.updated,
    skippedDuplicate: job.skippedDuplicate,
    skippedLimit: job.skippedLimit,
    invalid: job.invalid,
    errorMessage: job.errorMessage,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export function parseImportFileBytes(
  fileFormat: ContactImportFileFormat,
  bytes: Buffer,
  options: {
    attributeKeyByHeader?: Record<string, string>;
    occasionKeyByHeader?: Record<string, string>;
  } = {},
): ParseContactCsvResult {
  if (bytes.byteLength === 0) {
    throw new ContactValidationError("Import file is empty");
  }

  if (bytes.byteLength > MAX_IMPORT_FILE_BYTES) {
    throw new ContactValidationError(
      `Import file is too large (max ${Math.floor(MAX_IMPORT_FILE_BYTES / 1_000_000)} MB)`,
    );
  }

  if (fileFormat === ContactImportFileFormat.CSV) {
    return parseContactCsv(bytes.toString("utf8"), options);
  }

  return parseContactExcel(bytes, options);
}

export function encodeParsedCache(parsed: ParseContactCsvResult): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(parsed), "utf8"));
}

export function decodeParsedCache(cache: Buffer): ParseContactCsvResult {
  const json = gunzipSync(cache).toString("utf8");
  return JSON.parse(json) as ParseContactCsvResult;
}

export async function getActiveImportJobForOrganization(
  organizationId: string,
) {
  return prisma.contactImportJob.findFirst({
    where: {
      organizationId,
      status: { in: [ContactImportJobStatus.PENDING, ContactImportJobStatus.PROCESSING] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function enqueueContactImportJob(input: {
  organizationId: string;
  createdByUserId: string;
  fileName: string;
  fileFormat: ContactImportFileFormat;
  fileBytes: Buffer;
  fieldMappings?: unknown;
}): Promise<SerializedImportJob> {
  if (input.fileBytes.byteLength > MAX_IMPORT_FILE_BYTES) {
    throw new ContactValidationError(
      `Import file is too large (max ${Math.floor(MAX_IMPORT_FILE_BYTES / 1_000_000)} MB)`,
    );
  }

  const active = await getActiveImportJobForOrganization(input.organizationId);
  if (active) {
    throw new ContactImportJobConflictError();
  }

  try {
    parseImportFileBytes(input.fileFormat, input.fileBytes);
  } catch (error) {
    if (error instanceof ContactValidationError) {
      throw error;
    }
    throw new ContactValidationError(
      error instanceof Error ? error.message : "Invalid import file",
    );
  }

  const job = await prisma.contactImportJob.create({
    data: {
      organizationId: input.organizationId,
      createdByUserId: input.createdByUserId,
      fileName: input.fileName,
      fileFormat: input.fileFormat,
      fileBytes: Uint8Array.from(input.fileBytes),
      fieldMappings:
        input.fieldMappings === undefined
          ? undefined
          : (input.fieldMappings as Prisma.InputJsonValue),
      status: ContactImportJobStatus.PENDING,
    },
  });

  return serializeJob(job);
}

export async function getContactImportJobForOrganization(
  organizationId: string,
  jobId: string,
): Promise<SerializedImportJob> {
  const job = await prisma.contactImportJob.findFirst({
    where: { id: jobId, organizationId },
  });

  if (!job) {
    throw new ContactImportJobNotFoundError();
  }

  return serializeJob(job);
}

export async function listContactImportJobErrors(
  organizationId: string,
  jobId: string,
  options: { page?: number; limit?: number } = {},
) {
  const job = await prisma.contactImportJob.findFirst({
    where: { id: jobId, organizationId },
    select: { id: true },
  });

  if (!job) {
    throw new ContactImportJobNotFoundError();
  }

  const page = options.page ?? 1;
  const limit = Math.min(options.limit ?? 100, 500);
  const skip = (page - 1) * limit;

  const [total, errors] = await prisma.$transaction([
    prisma.contactImportJobError.count({ where: { jobId } }),
    prisma.contactImportJobError.findMany({
      where: { jobId },
      orderBy: [{ row: "asc" }, { id: "asc" }],
      skip,
      take: limit,
    }),
  ]);

  return {
    data: errors.map((error) => ({
      row: error.row,
      message: error.message,
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function cancelContactImportJob(
  organizationId: string,
  jobId: string,
): Promise<SerializedImportJob> {
  const job = await prisma.contactImportJob.findFirst({
    where: { id: jobId, organizationId },
  });

  if (!job) {
    throw new ContactImportJobNotFoundError();
  }

  if (
    job.status !== ContactImportJobStatus.PENDING &&
    job.status !== ContactImportJobStatus.PROCESSING
  ) {
    throw new ContactValidationError("Only in-progress imports can be cancelled");
  }

  const updated = await prisma.contactImportJob.update({
    where: { id: jobId },
    data: {
      status: ContactImportJobStatus.CANCELLED,
      completedAt: new Date(),
      leaseExpiresAt: null,
      claimedAt: null,
    },
  });

  return serializeJob(updated);
}

export async function ensureImportJobParsed(jobId: string): Promise<{
  parsed: ParseContactCsvResult;
  totalRows: number;
}> {
  const job = await prisma.contactImportJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new ContactImportJobNotFoundError();
  }

  if (job.parsedCache) {
    const parsed = decodeParsedCache(Buffer.from(job.parsedCache));
    return {
      parsed,
      totalRows: job.totalRows || parsed.rows.length,
    };
  }

  const resolvedMappings = await resolveImportFieldMappings(
    job.organizationId,
    parseStoredImportFieldMappings(job.fieldMappings),
  );
  const parsed = parseImportFileBytes(
    job.fileFormat,
    Buffer.from(job.fileBytes),
    resolvedMappings,
  );

  const dataRowCount = parsed.rows.length;
  if (dataRowCount > MAX_IMPORT_ROWS_PER_JOB) {
    throw new ContactValidationError(
      `Import has too many rows (max ${MAX_IMPORT_ROWS_PER_JOB} contacts per import)`,
    );
  }

  const parsedCache = encodeParsedCache(parsed);
  const totalRows = dataRowCount;

  await prisma.contactImportJob.update({
    where: { id: jobId },
    data: {
      parsedCache: Uint8Array.from(parsedCache),
      totalRows,
      invalid: { increment: parsed.errors.length },
    },
  });

  if (parsed.errors.length > 0) {
    await storeImportJobErrors(jobId, parsed.errors);
  }

  return { parsed, totalRows };
}

export async function storeImportJobErrors(
  jobId: string,
  errors: Array<{ row: number; message: string }>,
) {
  if (errors.length === 0) {
    return;
  }

  const existingCount = await prisma.contactImportJobError.count({
    where: { jobId },
  });

  const remaining = Math.max(0, MAX_IMPORT_JOB_ERRORS - existingCount);
  if (remaining === 0) {
    return;
  }

  const toStore = errors.slice(0, remaining);
  await prisma.contactImportJobError.createMany({
    data: toStore.map((error) => ({
      jobId,
      row: error.row,
      message: error.message,
    })),
  });
}

export async function getRemainingActiveContactSlots(
  organizationId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  const subscription = await tx.subscription.findUnique({
    where: { organizationId },
  });

  if (!subscription) {
    return 0;
  }

  const activeCount = await tx.contact.count({
    where: { organizationId, isActive: true },
  });

  return Math.max(0, subscription.contactLimit - activeCount);
}

export { serializeJob, MAX_IMPORT_ROWS_PER_JOB };
