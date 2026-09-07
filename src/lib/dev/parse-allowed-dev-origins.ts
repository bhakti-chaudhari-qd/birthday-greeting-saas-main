/**
 * Parses optional ALLOWED_DEV_ORIGINS for Next.js development only.
 * Returns hostnames/origins suitable for `allowedDevOrigins`.
 */
export function parseAllowedDevOrigins(
  value: string | undefined,
): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
