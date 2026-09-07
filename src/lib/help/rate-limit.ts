/**
 * Lightweight in-memory rate limit for help chat (per organization).
 * Enough to protect OpenAI spend on a single Node process.
 */

type Bucket = {
  count: number;
  windowStartMs: number;
};

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 40;

const buckets = new Map<string, Bucket>();

export class HelpRateLimitError extends Error {
  constructor(message = "Too many help questions. Please try again later.") {
    super(message);
    this.name = "HelpRateLimitError";
  }
}

export function assertHelpChatAllowed(organizationId: string): void {
  const key = `help:${organizationId}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStartMs > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStartMs: now });
    return;
  }

  if (existing.count >= MAX_PER_WINDOW) {
    throw new HelpRateLimitError();
  }

  existing.count += 1;
  buckets.set(key, existing);
}

/** Test helper */
export function resetHelpRateLimits(): void {
  buckets.clear();
}
