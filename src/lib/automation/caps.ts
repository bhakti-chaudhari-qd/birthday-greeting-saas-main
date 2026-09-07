/** Maximum queue rows created per organization per automation cron invocation. */
export const MAX_AUTOMATION_CREATES_CEILING = 10_000;

/** Minimum queue rows created per organization per automation cron invocation. */
export function minAutomationCreatesFloor(): number {
  const configured = Number.parseInt(
    process.env.AUTOMATION_CREATES_FLOOR ?? "500",
    10,
  );
  return Number.isFinite(configured) && configured > 0 ? configured : 500;
}

/**
 * Scale automation throughput with tenant size.
 * A 300k-contact org gets ~10k creates/run; smaller orgs get at least 500.
 */
export function resolveAutomationCreatesPerRun(contactLimit: number): number {
  const floor = minAutomationCreatesFloor();
  const normalized = Number.isFinite(contactLimit) && contactLimit > 0
    ? contactLimit
    : floor;

  return Math.min(
    MAX_AUTOMATION_CREATES_CEILING,
    Math.max(floor, Math.ceil(normalized / 30)),
  );
}
