/**
 * Local development helper: run automation ticks on an interval.
 *
 * Default interval: 60 minutes (production-like hourly cadence).
 * When started via `npm run dev`, the demo wrapper defaults to 1 minute.
 * Override with --interval-minutes N or AUTOMATION_SCHEDULER_INTERVAL_MINUTES.
 *
 * Production should still use an external HTTP scheduler against the
 * CRON_SECRET-protected routes; this CLI is for local hands-off testing.
 */
import 'dotenv/config'
import { spawn } from "node:child_process";
import path from "node:path";

import { loadLocalEnv } from "./load-local-env";

loadLocalEnv();

const DEFAULT_INTERVAL_MINUTES = 60;
const MIN_INTERVAL_MINUTES = 1;
const MAX_INTERVAL_MINUTES = 24 * 60;

function parseIntervalMinutes(argv: string[]): number {
  const flagIndex = argv.indexOf("--interval-minutes");
  if (flagIndex !== -1) {
    const raw = argv[flagIndex + 1];
    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) {
      throw new Error(
        "Usage: npm run automation:scheduler -- --interval-minutes <positive-integer>",
      );
    }
    return parsed;
  }

  const fromEnv = process.env.AUTOMATION_SCHEDULER_INTERVAL_MINUTES?.trim();
  if (fromEnv) {
    const parsed = Number(fromEnv);
    if (!Number.isInteger(parsed)) {
      throw new Error(
        "AUTOMATION_SCHEDULER_INTERVAL_MINUTES must be a positive integer",
      );
    }
    return parsed;
  }

  return DEFAULT_INTERVAL_MINUTES;
}

function runTickOnce(): Promise<number> {
  const scriptPath = path.join(
    process.cwd(),
    "scripts",
    "run-automation-tick.ts",
  );

  return new Promise((resolve, reject) => {
    // shell: true keeps Windows npm/.bin resolution reliable for tsx
    const child = spawn("npx", ["tsx", scriptPath], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
      shell: true,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`automation:tick terminated by signal ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const supported = argv.every(
    (arg, index) =>
      arg === "--interval-minutes" ||
      (index > 0 && argv[index - 1] === "--interval-minutes"),
  );

  if (!supported) {
    console.error(
      "Usage: npm run automation:scheduler -- [--interval-minutes <minutes>]",
    );
    process.exit(1);
  }

  let intervalMinutes: number;
  try {
    intervalMinutes = parseIntervalMinutes(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
    return;
  }

  if (
    intervalMinutes < MIN_INTERVAL_MINUTES ||
    intervalMinutes > MAX_INTERVAL_MINUTES
  ) {
    console.error(
      `Interval must be between ${MIN_INTERVAL_MINUTES} and ${MAX_INTERVAL_MINUTES} minutes.`,
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required. Set it in .env.local or .env.");
    process.exit(1);
  }

  const intervalMs = intervalMinutes * 60_000;
  console.log(
    `Local automation scheduler started (interval: ${intervalMinutes} minute(s)). Ctrl+C to stop.`,
  );

  let stopping = false;
  const requestStop = () => {
    if (stopping) {
      return;
    }
    stopping = true;
    console.log("\nStopping automation scheduler after the current tick…");
  };

  process.on("SIGINT", requestStop);
  process.on("SIGTERM", requestStop);

  while (!stopping) {
    const startedAt = new Date().toISOString();
    console.log(`\n=== Automation tick @ ${startedAt} ===`);

    try {
      const code = await runTickOnce();
      if (code !== 0) {
        console.error(`automation:tick exited with code ${code}`);
      }
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : "Failed to run automation tick",
      );
    }

    if (stopping) {
      break;
    }

    console.log(`Next tick in ${intervalMinutes} minute(s)…`);
    const wakeAt = Date.now() + intervalMs;
    while (!stopping && Date.now() < wakeAt) {
      await sleep(Math.min(1_000, wakeAt - Date.now()));
    }
  }

  console.log("Automation scheduler stopped.");
}

void main();
