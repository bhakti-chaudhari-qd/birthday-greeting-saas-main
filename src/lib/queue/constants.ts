/** Maximum provider-reaching attempts per queue row (including ambiguous). */
export const MAX_SEND_ATTEMPTS = 5;

/**
 * messagesSentThisMonth tracks reserved monthly send capacity against
 * monthlyMessageLimit + bonusMessageCredits. Capacity is reserved once at
 * queue generation. Sending and retries do not increment usage again.
 * bonusMessageCredits clears on IST calendar-month rollover with usage.
 */
export const MONTHLY_USAGE_RESERVATION_POLICY =
  "reservation-at-generation" as const;

/**
 * Messaging usage limits use Asia/Kolkata calendar months.
 * Subscription.billingPeriodStart / billingPeriodEnd are reused as the
 * usage-period watermark (not invoicing).
 */
export const USAGE_PERIOD_TIMEZONE = "Asia/Kolkata" as const;

/** Max queue rows claimed per organization per worker claim cycle. */
export const WORKER_CLAIM_BATCH_SIZE_PER_TENANT = 100;

/** Max concurrent provider send calls across one worker invocation. */
export const WORKER_GLOBAL_SEND_CONCURRENCY = Number.parseInt(
  process.env.WORKER_GLOBAL_SEND_CONCURRENCY ?? "25",
  10,
) || 25;

/**
 * How many organizations one worker invocation claims and sends for at the
 * same time. Provider calls across all of them still share
 * WORKER_GLOBAL_SEND_CONCURRENCY.
 */
export const WORKER_TENANT_CONCURRENCY = Number.parseInt(
  process.env.WORKER_TENANT_CONCURRENCY ?? "4",
  10,
) || 4;

/**
 * How long a scheduler tick keeps starting new worker passes. Each pass takes
 * at most one claim batch per organization, so one pass a minute would cap
 * every organization at one batch a minute. Kept under the 30s request
 * timeout common to external cron services.
 */
export const WORKER_DRAIN_TIME_BUDGET_MS = Number.parseInt(
  process.env.WORKER_DRAIN_TIME_BUDGET_MS ?? "25000",
  10,
) || 25_000;

/** How long a claimed SENDING row may be held before lease recovery. */
export const QUEUE_LEASE_DURATION_MS = 5 * 60 * 1000;

/**
 * A claimed row is not started once this much of its lease is used up; lease
 * recovery returns it to the queue untouched. Leaves room for the slowest
 * provider timeout (90s) so a send never outlives its own lease.
 */
export const WORKER_LEASE_START_CUTOFF_MS =
  QUEUE_LEASE_DURATION_MS - 2 * 60 * 1000;

/** Base delay for exponential backoff after a safely retryable failure. */
export const RETRY_BACKOFF_BASE_MS = 30_000;

/** Cap for retry backoff delay (before jitter). */
export const RETRY_BACKOFF_MAX_MS = 60 * 60 * 1000;

/** Jitter fraction applied to backoff (±). */
export const RETRY_BACKOFF_JITTER_RATIO = 0.2;

/** Error code for ambiguous provider acceptance (no automatic retry). */
export const AMBIGUOUS_PROVIDER_OUTCOME = "AMBIGUOUS_PROVIDER_OUTCOME" as const;

export const AMBIGUOUS_PROVIDER_OUTCOME_MESSAGE =
  "Provider acceptance is unknown. The provider may already have accepted this message. Retrying may send a duplicate." as const;

export const TEST_PROVIDER_FAIL_MOBILE_SUFFIX = "000001";

/**
 * A PENDING row whose template needs a personalized PDF is not claimable until
 * the PDF is attached, for this long after creation. Covers the gap between
 * the row being saved and its PDF finishing generation; past it the row is
 * claimed anyway and fails visibly (DOCUMENT_NOT_READY) if the PDF never came.
 */
export const DOCUMENT_PREPARATION_GRACE_MS = 10 * 60 * 1000;

/** PENDING rows older than this with a due nextAttemptAt are treated as stuck. */
export const STUCK_PENDING_THRESHOLD_MS = 15 * 60 * 1000;

/** Permanent / non-auto-retry error codes (documentation + classify alignment). */
export const PERMANENT_ERROR_CODES = [
  AMBIGUOUS_PROVIDER_OUTCOME,
  "TEMPLATE_NOT_READY",
  "INVALID_CREDENTIALS",
  "INVALID_SENDER_ID",
  "INVALID_ROUTE",
  "MISSING_TEMPLATE_ID",
  "UNKNOWN_PROVIDER",
  "INVALID_RECIPIENT",
  "INVALID_BODY",
  "SUBMISSION_ERROR",
  "INVALID_PROVIDER_CONFIG",
  "SEND_FAILED",
  "PROVIDER_HTTP_4XX",
  "DOCUMENT_NOT_READY",
  "DOCUMENT_NOT_FOUND",
  "DOCUMENT_EXPIRED",
] as const;
