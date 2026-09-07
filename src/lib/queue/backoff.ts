import {
  MAX_SEND_ATTEMPTS,
  RETRY_BACKOFF_BASE_MS,
  RETRY_BACKOFF_JITTER_RATIO,
  RETRY_BACKOFF_MAX_MS,
} from "./constants";

export type BackoffRandom = () => number;

function defaultRandom() {
  return Math.random();
}

/**
 * Exponential backoff with bounded jitter for attemptNumber (1-based finalized count).
 * delay = min(base * 2^(attempt-1), max) * (1 ± jitterRatio)
 */
export function computeRetryDelayMs(
  attemptNumber: number,
  random: BackoffRandom = defaultRandom,
): number {
  const exponent = Math.max(0, attemptNumber - 1);
  const raw = Math.min(
    RETRY_BACKOFF_BASE_MS * 2 ** exponent,
    RETRY_BACKOFF_MAX_MS,
  );
  const jitterSpan = raw * RETRY_BACKOFF_JITTER_RATIO;
  const jitter = (random() * 2 - 1) * jitterSpan;
  return Math.max(0, Math.round(raw + jitter));
}

export function computeNextAttemptAt(
  attemptNumber: number,
  now: Date = new Date(),
  random: BackoffRandom = defaultRandom,
): Date | null {
  if (attemptNumber >= MAX_SEND_ATTEMPTS) {
    return null;
  }

  return new Date(now.getTime() + computeRetryDelayMs(attemptNumber, random));
}
