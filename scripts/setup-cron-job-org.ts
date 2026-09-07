/**
 * Create/update the cron-job.org job that hits /api/v1/internal/cron/tick.
 *
 * Prerequisites:
 * 1. Free account at https://console.cron-job.org/
 * 2. Settings → create an API key
 * 3. Same CRON_SECRET as Vercel production
 *
 * Usage:
 *   CRONJOB_ORG_API_KEY=... ^
 *   CRON_SECRET=... ^
 *   CRON_BASE_URL=https://birthday-greeting-saas.vercel.app ^
 *   npm run cron:setup-external
 */
import { loadLocalEnv } from "./load-local-env";

const API = "https://api.cron-job.org";
const JOB_TITLE = "birthday-greeting-saas production cron tick";

type CronJob = {
  jobId: number;
  title?: string;
  url?: string;
  enabled?: boolean;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function everyMinuteSchedule(timezone: string) {
  return {
    timezone,
    expiresAt: 0,
    hours: [-1],
    mdays: [-1],
    minutes: [-1],
    months: [-1],
    wdays: [-1],
  };
}

async function api<T>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  if (!response.ok) {
    throw new Error(
      `cron-job.org ${method} ${path} failed (${response.status}): ${text}`,
    );
  }

  return json as T;
}

async function main() {
  loadLocalEnv();

  const apiKey = requireEnv("CRONJOB_ORG_API_KEY");
  const cronSecret = requireEnv("CRON_SECRET");
  const baseUrl = (
    process.env.CRON_BASE_URL?.trim() ||
    "https://birthday-greeting-saas.vercel.app"
  ).replace(/\/$/, "");
  const timezone =
    process.env.CRONJOB_ORG_TIMEZONE?.trim() || "Asia/Kolkata";
  const tickUrl = `${baseUrl}/api/v1/internal/cron/tick`;

  const jobPayload = {
    job: {
      enabled: true,
      title: JOB_TITLE,
      url: tickUrl,
      requestMethod: 1, // POST
      saveResponses: false,
      requestTimeout: 90,
      redirectSuccess: false,
      schedule: everyMinuteSchedule(timezone),
      extendedData: {
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      },
    },
  };

  const listed = await api<{ jobs: CronJob[] }>(apiKey, "GET", "/jobs");
  const existing = (listed.jobs ?? []).find(
    (job) => job.title === JOB_TITLE || job.url === tickUrl,
  );

  if (existing?.jobId) {
    await api(apiKey, "PATCH", `/jobs/${existing.jobId}`, jobPayload);
    console.log(`Updated cron-job.org job #${existing.jobId}`);
  } else {
    const created = await api<{ jobId: number }>(
      apiKey,
      "PUT",
      "/jobs",
      jobPayload,
    );
    console.log(`Created cron-job.org job #${created.jobId}`);
  }

  console.log(`URL: ${tickUrl}`);
  console.log(`Schedule: every minute (${timezone})`);
  console.log("Done. Check history at https://console.cron-job.org/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
