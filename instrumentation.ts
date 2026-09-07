/**
 * Runs once when the Next.js Node server starts. Validates env so production
 * fails closed before serving traffic if required secrets are missing.
 * Skips the production-build phase (NODE_ENV=production during `next build`).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  const { parseEnv } = await import("./src/lib/env");
  parseEnv();
}
