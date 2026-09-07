import { Prisma } from "@prisma/client";

const TRANSIENT_PRISMA_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // Database server reached but timed out
  "P1008", // Operations timed out
  "P1017", // Server has closed the connection
  "P2024", // Timed out fetching a connection from the pool
]);

const TRANSIENT_MESSAGE_RE =
  /can'?t reach database|connection (?:refused|terminated|reset|timed out)|timed out fetching a new connection|server has closed the connection|econnrefused|etimedout|enotfound|connect econnreset/i;

export type TransientDbRetryOptions = {
  /** Extra attempts after the first try. Default 2 (3 total). */
  retries?: number;
  /** Delay before the first retry in ms. Default 750. */
  delayMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** True for connection / wake-up failures that are often fixed by a short wait. */
export function isTransientDatabaseError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_PRISMA_CODES.has(error.code);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return TRANSIENT_MESSAGE_RE.test(error.message);
  }

  if (error instanceof Error) {
    return TRANSIENT_MESSAGE_RE.test(error.message);
  }

  return false;
}

/**
 * Retries a DB-backed operation when Neon/serverless Postgres is waking up
 * or the connection briefly fails.
 */
export async function withTransientDbRetry<T>(
  operation: () => Promise<T>,
  options: TransientDbRetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const delayMs = options.delayMs ?? 750;

  let attempt = 0;
  for (;;) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientDatabaseError(error) || attempt >= retries) {
        throw error;
      }

      attempt += 1;
      await sleep(delayMs * attempt);
    }
  }
}
