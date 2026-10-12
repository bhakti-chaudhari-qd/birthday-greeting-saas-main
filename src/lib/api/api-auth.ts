import { authenticateApiKey } from "@/lib/api-keys/service";
import { RateLimitError } from "@/lib/auth/rate-limit";
import type { AuthContext } from "@/lib/auth/types";

import { requireSessionAdmin, requireSessionAuth } from "./session-auth";

export { sessionAuthErrorResponse } from "./session-auth";

const API_KEY_RATE_WINDOW_MS = 60 * 1000;
export const API_KEY_RATE_MAX_PER_WINDOW = 120;

/** Per-process fixed-window counters, keyed by ApiKey id. */
const apiKeyRateWindows = new Map<string, { windowStart: number; hits: number }>();

function consumeApiKeyRateLimit(apiKeyId: string): void {
  const now = Date.now();
  const current = apiKeyRateWindows.get(apiKeyId);

  if (!current || now - current.windowStart >= API_KEY_RATE_WINDOW_MS) {
    apiKeyRateWindows.set(apiKeyId, { windowStart: now, hits: 1 });
    return;
  }

  if (current.hits >= API_KEY_RATE_MAX_PER_WINDOW) {
    throw new RateLimitError("Too many requests. Try again in a minute.");
  }

  current.hits += 1;
}

function readBearerToken(request: Request | undefined): string | null {
  const header = request?.headers.get("authorization");
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : "";
}

/**
 * Auth for routes opened to external integrations: an
 * `Authorization: Bearer bw_live_...` API key, or the dashboard session
 * cookie when no Authorization header is sent. A request that sends a bad
 * key is rejected - it never falls back to the cookie.
 */
export async function requireApiAuth(request?: Request): Promise<AuthContext> {
  const token = readBearerToken(request);

  if (token === null) {
    return requireSessionAuth();
  }

  const resolved = await authenticateApiKey(token);

  if (!resolved) {
    throw new Error("UNAUTHORIZED");
  }

  consumeApiKeyRateLimit(resolved.apiKeyId);

  return resolved.auth;
}

/**
 * Owner-level variant. API keys are full-access (Owner role), so this only
 * narrows cookie sessions - Staff sessions are rejected as before.
 */
export async function requireApiAdmin(request?: Request): Promise<AuthContext> {
  const token = readBearerToken(request);

  if (token === null) {
    return requireSessionAdmin();
  }

  return requireApiAuth(request);
}
