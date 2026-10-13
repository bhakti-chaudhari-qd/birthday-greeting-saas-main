import { prisma } from "@/lib/db";

/** Arbitrary constant key for pg_try_advisory_xact_lock (cron tick). */
const CRON_TICK_ADVISORY_LOCK_KEY = 728_310_441;

/**
 * Upper bound on how long one tick may hold the lock. Past it Prisma closes
 * the lock transaction, so a hung tick cannot block scheduling forever.
 */
const CRON_TICK_LOCK_MAX_HOLD_MS = 15 * 60 * 1000;

export type TickLockResult<T> =
  | { acquired: true; value: T }
  | { acquired: false };

/**
 * Runs `fn` only if no other cron tick is in flight (any process sharing this
 * database). The scheduler fires every minute; a tick that runs longer must
 * not be stacked on by the next one.
 *
 * The lock is a transaction-level advisory lock, so it is released when the
 * holding transaction ends - including when the process dies mid-tick. `fn`
 * does its own work on the shared client, outside that transaction.
 */
export async function withCronTickLock<T>(
  fn: () => Promise<T>,
): Promise<TickLockResult<T>> {
  let ran = false;
  let value: T | undefined;
  let failure: { error: unknown } | null = null;

  try {
    await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`
          SELECT pg_try_advisory_xact_lock(${CRON_TICK_ADVISORY_LOCK_KEY}::bigint) AS locked
        `;

        if (!rows[0]?.locked) {
          return;
        }

        ran = true;
        try {
          value = await fn();
        } catch (error) {
          failure = { error };
        }
      },
      { maxWait: 10_000, timeout: CRON_TICK_LOCK_MAX_HOLD_MS },
    );
  } catch (error) {
    // The tick's work already finished; only the lock transaction failed to
    // close cleanly (e.g. it outlived CRON_TICK_LOCK_MAX_HOLD_MS).
    if (!ran) {
      throw error;
    }
    console.error("Cron tick lock transaction did not close cleanly", error);
  }

  if (failure) {
    throw (failure as { error: unknown }).error;
  }

  if (!ran) {
    return { acquired: false };
  }

  return { acquired: true, value: value as T };
}
