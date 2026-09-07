import { describe, expect, it } from "vitest";

import { computeRetryDelayMs, computeNextAttemptAt } from "@/lib/queue/backoff";
import {
  classifySendFailure,
  isAutoClaimBlockedErrorCode,
  RETRYABLE_ERROR_CODES,
} from "@/lib/queue/classify";
import {
  AMBIGUOUS_PROVIDER_OUTCOME,
  RETRY_BACKOFF_BASE_MS,
  RETRY_BACKOFF_MAX_MS,
} from "@/lib/queue/constants";

describe("failure classification", () => {
  it("classifies permanent, retryable, and ambiguous codes", () => {
    expect(classifySendFailure("TEMPLATE_NOT_READY")).toBe("permanent");
    expect(classifySendFailure("INVALID_CREDENTIALS")).toBe("permanent");
    expect(classifySendFailure("INVALID_PROVIDER_CONFIG")).toBe("permanent");
    expect(classifySendFailure("SEND_FAILED")).toBe("permanent");
    expect(classifySendFailure("PROVIDER_HTTP_4XX")).toBe("permanent");
    expect(classifySendFailure(AMBIGUOUS_PROVIDER_OUTCOME)).toBe("ambiguous");
    expect(classifySendFailure("PROVIDER_TIMEOUT")).toBe("ambiguous");
    expect(classifySendFailure("PROVIDER_NETWORK_ERROR")).toBe("ambiguous");
    expect(classifySendFailure("PROVIDER_HTTP_5XX")).toBe("ambiguous");
    expect(classifySendFailure("PROVIDER_HTTP_429")).toBe("ambiguous");
    expect(classifySendFailure("TEST_PROVIDER_FAIL")).toBe("retryable");
    expect(classifySendFailure("INSUFFICIENT_BALANCE")).toBe("retryable");
    expect(classifySendFailure("SEND_VELOCITY_LIMIT")).toBe("retryable");
    expect(classifySendFailure("UNKNOWN_CODE")).toBe("permanent");
  });

  it("blocks auto-claim for non-retryable codes including unknown", () => {
    expect(isAutoClaimBlockedErrorCode("INVALID_PROVIDER_CONFIG")).toBe(true);
    expect(isAutoClaimBlockedErrorCode("PROVIDER_HTTP_429")).toBe(true);
    expect(isAutoClaimBlockedErrorCode("PROVIDER_HTTP_4XX")).toBe(true);
    expect(isAutoClaimBlockedErrorCode("WEIRD_NEW_CODE")).toBe(true);
    expect(isAutoClaimBlockedErrorCode("TEST_PROVIDER_FAIL")).toBe(false);
    expect(isAutoClaimBlockedErrorCode("SEND_VELOCITY_LIMIT")).toBe(false);
    expect(isAutoClaimBlockedErrorCode(null)).toBe(false);
    expect(RETRYABLE_ERROR_CODES).toContain("TEST_PROVIDER_FAIL");
    expect(RETRYABLE_ERROR_CODES).toContain("SEND_VELOCITY_LIMIT");
    expect(RETRYABLE_ERROR_CODES).not.toContain("PROVIDER_RATE_LIMITED");
  });
});

describe("retry backoff", () => {
  it("applies exponential backoff with bounded jitter", () => {
    const mid = computeRetryDelayMs(1, () => 0.5);
    expect(mid).toBe(RETRY_BACKOFF_BASE_MS);

    const high = computeRetryDelayMs(1, () => 1);
    const low = computeRetryDelayMs(1, () => 0);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(RETRY_BACKOFF_BASE_MS * 1.2 + 1);
    expect(low).toBeGreaterThanOrEqual(RETRY_BACKOFF_BASE_MS * 0.8 - 1);

    const capped = computeRetryDelayMs(20, () => 0.5);
    expect(capped).toBe(RETRY_BACKOFF_MAX_MS);

    expect(computeNextAttemptAt(5, new Date(), () => 0.5)).toBeNull();
    expect(
      computeNextAttemptAt(1, new Date("2026-07-12T00:00:00.000Z"), () => 0.5),
    ).toEqual(new Date("2026-07-12T00:00:30.000Z"));
  });
});
