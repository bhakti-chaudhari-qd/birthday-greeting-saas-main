import type { NextResponse } from "next/server";

import { authenticateApiKey } from "@/lib/api-keys/service";
import { RateLimitError } from "@/lib/auth/rate-limit";

import { jsonError } from "./response";

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

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Auth for the integration routes (src/app/api/v1/integrations): requires
 * an `Authorization: Bearer bw_live_...` API key. The dashboard session
 * cookie is not accepted here, and API keys are not accepted anywhere else.
 */
export async function requireApiKey(
  request: Request,
): Promise<{ organizationId: string; apiKeyId: string }> {
  const token = readBearerToken(request);
  const resolved = token ? await authenticateApiKey(token) : null;

  if (!resolved) {
    throw new Error("API_KEY_UNAUTHORIZED");
  }

  consumeApiKeyRateLimit(resolved.apiKeyId);

  return resolved;
}

/** Maps API key failures to 401/429 responses; otherwise null. */
export function apiKeyAuthErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof Error && error.message === "API_KEY_UNAUTHORIZED") {
    return jsonError("A valid API key is required", 401);
  }

  if (error instanceof RateLimitError) {
    const response = jsonError(error.message, 429);
    response.headers.set("Retry-After", "60");
    return response;
  }

  return null;
}
