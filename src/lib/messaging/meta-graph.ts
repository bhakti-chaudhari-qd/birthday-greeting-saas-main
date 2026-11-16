const DEFAULT_TIMEOUT_MS = 15_000;

/** A Graph API call that failed; `message` is safe to show to the user. */
export class MetaGraphError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "MetaGraphError";
  }
}

/**
 * One call to graph.facebook.com with a bearer token. Meta's own
 * user-facing error text is surfaced as the error message, because it says
 * exactly what to fix (missing permission, name already used, bad text...).
 */
export async function metaGraphRequest(
  url: string,
  accessToken: string,
  init: { method: "GET" | "POST"; body?: unknown; timeoutMs?: number },
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    init.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new MetaGraphError("Meta did not respond in time. Try again.");
    }
    throw new MetaGraphError("Could not reach Meta. Try again.");
  } finally {
    clearTimeout(timeout);
  }

  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = json.error as
      | { message?: string; error_user_msg?: string }
      | undefined;
    throw new MetaGraphError(
      error?.error_user_msg ??
        error?.message ??
        `Meta returned an error (HTTP ${response.status})`,
      response.status,
    );
  }
  return json;
}
