/**
 * Local demo helper: start Next.js dev and the automation scheduler together.
 *
 * - `npm run dev` → this script
 * - `npm run dev:app` → Next.js only (no automation loop)
 * - Disable automation with DEV_AUTOMATION=0 or `npm run dev -- --no-automation`
 *
 * Always reclaims a single Next.js instance on port 3000 so orphaned
 * background servers (common on Windows after a crashed/killed terminal)
 * cannot leave you on 3001/3002/3003 or block startup.
 *
 * Demo default: automation ticks every 1 minute (override with
 * AUTOMATION_SCHEDULER_INTERVAL_MINUTES). Production must still use an
 * external HTTP cron against the CRON_SECRET-protected routes.
 */
import 'dotenv/config'
import { spawn, type ChildProcess } from "node:child_process";
import { execFileSync, execSync } from "node:child_process";
import path from "node:path";

const DEFAULT_DEMO_INTERVAL_MINUTES = 1;
const DEV_PORT = Number(process.env.PORT?.trim() || "3000");
const PROJECT_ROOT = process.cwd();
const PROJECT_MARKER = path.basename(PROJECT_ROOT);

function envFlagDisabled(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "0" || value === "false" || value === "off" || value === "no";
}

function resolveIntervalMinutes(): string {
  const fromEnv = process.env.AUTOMATION_SCHEDULER_INTERVAL_MINUTES?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return String(DEFAULT_DEMO_INTERVAL_MINUTES);
}

function killPidTree(pid: number) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGTERM");
    }
  } catch {
    // already gone
  }
}

function killProcessTree(child: ChildProcess) {
  if (!child.pid || child.killed) {
    return;
  }
  killPidTree(child.pid);
}

function listWindowsNodeCommandLines(): Array<{ pid: number; commandLine: string }> {
  try {
    const raw = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress",
      ],
      { encoding: "utf8", windowsHide: true },
    ).trim();

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as
      | { ProcessId: number; CommandLine: string | null }
      | Array<{ ProcessId: number; CommandLine: string | null }>;
    const rows = Array.isArray(parsed) ? parsed : [parsed];

    return rows
      .filter((row) => typeof row.CommandLine === "string" && row.CommandLine.length > 0)
      .map((row) => ({
        pid: row.ProcessId,
        commandLine: row.CommandLine as string,
      }));
  } catch {
    return [];
  }
}

function listUnixPidsMatching(pattern: RegExp): number[] {
  try {
    const raw = execFileSync("ps", ["-A", "-o", "pid=,command="], {
      encoding: "utf8",
    });
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        const match = /^(\d+)\s+(.+)$/.exec(line);
        if (!match) {
          return [];
        }
        const pid = Number(match[1]);
        const command = match[2];
        if (pid === process.pid || !pattern.test(command)) {
          return [];
        }
        return [pid];
      });
  } catch {
    return [];
  }
}

function collectProtectedPids(): Set<number> {
  const protectedPids = new Set<number>([process.pid]);
  if (typeof process.ppid === "number" && process.ppid > 0) {
    protectedPids.add(process.ppid);
  }

  if (process.platform === "win32") {
    try {
      // Protect the whole ancestor chain (npm → cmd/powershell → tsx → this script).
      const raw = execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `$procId=${process.pid}; while ($procId -gt 0) { $p = Get-CimInstance Win32_Process -Filter \"ProcessId = $procId\" -ErrorAction SilentlyContinue; if (-not $p) { break }; Write-Output $p.ProcessId; $procId = $p.ParentProcessId }`,
        ],
        { encoding: "utf8", windowsHide: true },
      );
      for (const line of raw.split(/\r?\n/)) {
        const pid = Number(line.trim());
        if (pid > 0) {
          protectedPids.add(pid);
        }
      }
    } catch {
      // ignore
    }
  }

  return protectedPids;
}

function isStaleDevCommand(commandLine: string): boolean {
  const normalized = commandLine.toLowerCase();
  const projectRoot = PROJECT_ROOT.toLowerCase();
  const projectMarker = PROJECT_MARKER.toLowerCase();
  const inProject =
    normalized.includes(projectRoot) || normalized.includes(projectMarker);

  // Never treat the current launcher as stale.
  if (normalized.includes("dev-with-automation")) {
    return false;
  }

  if (!inProject) {
    return false;
  }

  return (
    normalized.includes("next\\dist\\bin\\next") ||
    normalized.includes("next/dist/bin/next") ||
    normalized.includes("next\\dist\\server\\lib\\start-server") ||
    normalized.includes("next/dist/server/lib/start-server") ||
    normalized.includes(".next\\dev\\build") ||
    normalized.includes(".next/dev/build") ||
    normalized.includes("run-automation-scheduler") ||
    (/npx-cli\.js/i.test(commandLine) &&
      /\bnext\b/i.test(commandLine) &&
      /\bdev\b/i.test(commandLine))
  );
}

/**
 * Stop leftover Next.js / local automation processes for this repo so
 * `npm run dev` always owns a single portal on DEV_PORT.
 */
function stopStaleDevProcesses() {
  const protectedPids = collectProtectedPids();
  const pids = new Set<number>();

  if (process.platform === "win32") {
    for (const { pid, commandLine } of listWindowsNodeCommandLines()) {
      if (protectedPids.has(pid)) {
        continue;
      }
      if (isStaleDevCommand(commandLine)) {
        pids.add(pid);
      }
    }

    // Also free DEV_PORT if anything else is still listening.
    try {
      const netstat = execSync("netstat -ano", { encoding: "utf8" });
      const listenRe = new RegExp(
        `:${DEV_PORT}\\s+\\S+\\s+LISTENING\\s+(\\d+)`,
        "gi",
      );
      for (const match of netstat.matchAll(listenRe)) {
        const pid = Number(match[1]);
        if (pid > 0 && !protectedPids.has(pid)) {
          pids.add(pid);
        }
      }
    } catch {
      // ignore
    }
  } else {
    const projectNeedle = PROJECT_ROOT.replace(/\\/g, "\\\\");
    const pattern = new RegExp(
      `${projectNeedle}.*(next|run-automation-scheduler)|next\\s+dev`,
      "i",
    );
    for (const pid of listUnixPidsMatching(pattern)) {
      if (!protectedPids.has(pid)) {
        pids.add(pid);
      }
    }
  }

  if (pids.size === 0) {
    return;
  }

  console.log(
    `[dev] Stopping ${pids.size} stale local server process(es) so only one portal runs on :${DEV_PORT}.`,
  );
  for (const pid of pids) {
    if (protectedPids.has(pid)) {
      continue;
    }
    killPidTree(pid);
  }
}

function spawnNodeCommand(command: string, args: string[]): ChildProcess {
  // Prefer shell:false to avoid DEP0190 and keep process trees killable.
  if (process.platform === "win32") {
    return spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env: process.env,
      shell: true,
      windowsHide: true,
    });
  }

  return spawn(command, args, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env: process.env,
    shell: false,
  });
}

function main() {
  const argv = process.argv.slice(2);
  const noAutomation =
    argv.includes("--no-automation") || envFlagDisabled("DEV_AUTOMATION");
  const forwardedArgs = argv.filter((a) => a !== "--no-automation");

  stopStaleDevProcesses();

  const children: ChildProcess[] = [];
  let shuttingDown = false;

  const shutdown = (code = 0) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    for (const child of children) {
      killProcessTree(child);
    }
    process.exit(code);
  };

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  // Pin the port so Next never silently hops to 3001+ when a stale server exists.
  const nextArgs = ["next", "dev", "--port", String(DEV_PORT), ...forwardedArgs];
  const nextDev = spawnNodeCommand("npx", nextArgs);
  children.push(nextDev);

  nextDev.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    if (signal) {
      shutdown(1);
      return;
    }
    shutdown(code ?? 0);
  });

  if (noAutomation) {
    console.log(
      "[dev] Automation scheduler disabled (DEV_AUTOMATION=0 or --no-automation).",
    );
    return;
  }

  const intervalMinutes = resolveIntervalMinutes();
  console.log(
    `[dev] Starting local automation scheduler (every ${intervalMinutes} minute(s)). Disable with DEV_AUTOMATION=0 or npm run dev:app.`,
  );

  const scheduler = spawnNodeCommand("npx", [
    "tsx",
    "scripts/run-automation-scheduler.ts",
    "--interval-minutes",
    intervalMinutes,
  ]);
  children.push(scheduler);

  scheduler.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }
    console.error(
      `[dev] Automation scheduler exited unexpectedly (code=${code ?? "?"}${signal ? `, signal=${signal}` : ""}). Next.js will keep running; restart with npm run dev or run npm run automation:scheduler separately.`,
    );
    // Keep Next alive for the demo if the scheduler dies.
    const index = children.indexOf(scheduler);
    if (index >= 0) {
      children.splice(index, 1);
    }
  });
}

main();
