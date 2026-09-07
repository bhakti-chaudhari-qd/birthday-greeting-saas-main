/** Maximum decoded file size for a contact import upload. */
export const MAX_IMPORT_FILE_BYTES = 50_000_000;

/** Hard ceiling on data rows per import job. */
export const MAX_IMPORT_ROWS_PER_JOB = 500_000;

/** Rows processed per worker invocation. */
export const IMPORT_BATCH_SIZE = 1_000;

/**
 * Max contact updates per interactive transaction.
 * Re-imports update rows one-by-one; chunking avoids Prisma's default 5s tx timeout.
 */
export const IMPORT_UPDATE_CHUNK_SIZE = 100;

/** Interactive transaction options for import batch writes. */
export const IMPORT_TX_OPTIONS = {
  maxWait: 60_000,
  timeout: 120_000,
} as const;

/** How long a claimed import job may be held before lease recovery. */
export const IMPORT_LEASE_DURATION_MS = 5 * 60 * 1000;

/** Maximum row-level errors stored per import job. */
export const MAX_IMPORT_JOB_ERRORS = 5_000;

/** Legacy synchronous import row cap (small files only). */
export const SYNC_IMPORT_ROW_THRESHOLD = 500;
