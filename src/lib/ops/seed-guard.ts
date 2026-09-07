/**
 * Demo seed uses a well-known local password and must never run in production.
 */
export function assertSeedAllowed(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): void {
  if (nodeEnv === "production") {
    throw new Error(
      "Refusing to run database seed when NODE_ENV=production. Seed credentials (e.g. password123) are local-only.",
    );
  }
}
