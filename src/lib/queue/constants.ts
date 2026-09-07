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

/** How long a claimed SENDING row may be held before lease recovery. */
export const QUEUE_LEASE_DURATION_MS = 5 * 60 * 1000;

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
