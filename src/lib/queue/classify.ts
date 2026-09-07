import {
  AMBIGUOUS_PROVIDER_OUTCOME,
  PERMANENT_ERROR_CODES,
} from "./constants";

export type FailureClass = "permanent" | "retryable" | "ambiguous";

/**
 * Only these FAILED lastErrorCode values are eligible for automatic worker claim.
 * Unknown, permanent, and ambiguous codes are excluded (safer than denylist gaps).
 */
export const RETRYABLE_ERROR_CODES = [
  "TEST_PROVIDER_FAIL",
  "INSUFFICIENT_BALANCE",
  "PROVIDER_ERROR",
  "SEND_VELOCITY_LIMIT",
  "DOCUMENT_STORAGE_UNAVAILABLE",
] as const;

const RETRYABLE_SET = new Set<string>(RETRYABLE_ERROR_CODES);

const AMBIGUOUS_ERROR_CODES = new Set([
  AMBIGUOUS_PROVIDER_OUTCOME,
  "PROVIDER_TIMEOUT",
  "PROVIDER_NETWORK_ERROR",
  "PROVIDER_HTTP_5XX",
  "PROVIDER_HTTP_429",
  "FINALIZE_FAILED_AFTER_PROVIDER_SUCCESS",
]);

const PERMANENT_SET = new Set<string>([
  ...PERMANENT_ERROR_CODES,
  "INVALID_PROVIDER_CONFIG",
  "SEND_FAILED",
  "PROVIDER_HTTP_4XX",
  "PROVIDER_RATE_LIMITED", // legacy code; treat as permanent if present
  "CONTACT_INACTIVE",
  "ORGANIZATION_INACTIVE",
]);

/**
 * Classify a provider/send error for worker retry policy.
 *
 * CUSTOM_HTTP transport timeouts, network failures, HTTP 5xx, and HTTP 429 are
 * ambiguous: this gateway does not prove whether the SMS was accepted.
 * Non-429 HTTP 4xx responses are treated as definite client/permanent failures.
 * Parsed legacy status body codes are definite provider outcomes.
 */
export function classifySendFailure(errorCode: string): FailureClass {
  if (
    AMBIGUOUS_ERROR_CODES.has(errorCode) ||
    errorCode === AMBIGUOUS_PROVIDER_OUTCOME
  ) {
    return "ambiguous";
  }

  if (PERMANENT_SET.has(errorCode)) {
    return "permanent";
  }

  if (RETRYABLE_SET.has(errorCode)) {
    return "retryable";
  }

  // Unknown codes: do not auto-retry (safer than duplicate SMS).
  return "permanent";
}

export function isAutoClaimBlockedErrorCode(
  errorCode: string | null | undefined,
) {
  if (!errorCode) {
    return false;
  }

  return classifySendFailure(errorCode) !== "retryable";
}

export function isRetryableErrorCode(errorCode: string | null | undefined) {
  if (!errorCode) {
    return true;
  }

  return RETRYABLE_SET.has(errorCode);
}
