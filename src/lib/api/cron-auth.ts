import { timingSafeEqual } from "node:crypto";

export class CronAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CronAuthError";
  }
}

function safeCompareSecrets(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function requireCronSecret(request: Request): void {
  const configuredSecret = process.env.CRON_SECRET?.trim();

  if (!configuredSecret) {
    throw new CronAuthError("Scheduler authentication is not configured");
  }

  const authorization = request.headers.get("authorization");

  if (!authorization) {
    throw new CronAuthError("Authorization required");
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);

  if (!match?.[1]) {
    throw new CronAuthError("Invalid authorization header");
  }

  if (!safeCompareSecrets(match[1], configuredSecret)) {
    throw new CronAuthError("Invalid authorization");
  }
}
