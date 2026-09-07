import { z } from "zod";

const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CRON_SECRET: z.string().optional(),
  CREDENTIALS_ENCRYPTION_KEY: z.string().optional(),
  BILLING_ENABLED: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  APP_URL: z.string().url().optional(),
  PLATFORM_APP_URL: z.string().url().optional(),
  PLATFORM_SMS_BASE_URL: z.string().url().optional(),
  PLATFORM_SMS_SEND_PATH: z.string().optional(),
  PLATFORM_SMS_USERNAME: z.string().optional(),
  PLATFORM_SMS_PASSWORD: z.string().optional(),
  PLATFORM_SMS_ROUTE: z.string().optional(),
  PLATFORM_SMS_SENDER_ID: z.string().optional(),
  PLATFORM_SMS_DLT_TEMPLATE_ID: z.string().optional(),
  PLATFORM_SMS_INVITATION_BODY_TEMPLATE: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
});

export type Env = z.infer<typeof baseEnvSchema>;

export type PlatformSmsConfig = {
  appUrl: string;
  baseUrl: string;
  sendPath: string;
  username: string;
  password: string;
  route: string;
  senderId: string;
  dltTemplateId: string;
  invitationBodyTemplate: string;
  requestTimeoutMs: number;
  successStatusCode: number;
};

const platformSmsEnvKeys = [
  "PLATFORM_APP_URL",
  "PLATFORM_SMS_BASE_URL",
  "PLATFORM_SMS_SEND_PATH",
  "PLATFORM_SMS_USERNAME",
  "PLATFORM_SMS_PASSWORD",
  "PLATFORM_SMS_ROUTE",
  "PLATFORM_SMS_SENDER_ID",
  "PLATFORM_SMS_DLT_TEMPLATE_ID",
  "PLATFORM_SMS_INVITATION_BODY_TEMPLATE",
] as const;

export function getPlatformSmsConfig(
  raw: Record<string, string | undefined> = process.env,
): PlatformSmsConfig | null {
  const missing = platformSmsEnvKeys.filter((key) => !hasNonEmpty(raw[key]));

  if (missing.length > 0) {
    if ((raw.NODE_ENV ?? process.env.NODE_ENV) === "test") {
      return null;
    }
    throw new Error(
      `Platform SMS is not configured; missing: ${missing.join(", ")}`,
    );
  }

  const sendPath = raw.PLATFORM_SMS_SEND_PATH!.trim();
  if (!sendPath.startsWith("/")) {
    throw new Error("PLATFORM_SMS_SEND_PATH must start with /");
  }

  const appUrl = new URL(raw.PLATFORM_APP_URL!.trim());
  const baseUrl = new URL(raw.PLATFORM_SMS_BASE_URL!.trim());
  const environment = raw.NODE_ENV ?? process.env.NODE_ENV;
  const allowedProtocols =
    environment === "production" ? ["https:"] : ["http:", "https:"];
  if (!allowedProtocols.includes(appUrl.protocol)) {
    throw new Error(
      "PLATFORM_APP_URL must use https in production (http is allowed only in development or test)",
    );
  }
  if (!allowedProtocols.includes(baseUrl.protocol)) {
    throw new Error(
      "PLATFORM_SMS_BASE_URL must use https in production (http is allowed only in development or test)",
    );
  }

  return {
    appUrl: appUrl.toString(),
    baseUrl: baseUrl.toString(),
    sendPath,
    username: raw.PLATFORM_SMS_USERNAME!.trim(),
    password: raw.PLATFORM_SMS_PASSWORD!,
    route: raw.PLATFORM_SMS_ROUTE!.trim(),
    senderId: raw.PLATFORM_SMS_SENDER_ID!.trim(),
    dltTemplateId: raw.PLATFORM_SMS_DLT_TEMPLATE_ID!.trim(),
    invitationBodyTemplate:
      raw.PLATFORM_SMS_INVITATION_BODY_TEMPLATE!.trim(),
    requestTimeoutMs: 10_000,
    successStatusCode: 1,
  };
}

function isTruthyFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function hasNonEmpty(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

/** True when billing is explicitly enabled or any Razorpay key is present. */
export function isBillingConfigured(
  raw: Record<string, string | undefined>,
): boolean {
  if (isTruthyFlag(raw.BILLING_ENABLED)) {
    return true;
  }

  return (
    hasNonEmpty(raw.RAZORPAY_KEY_ID) ||
    hasNonEmpty(raw.RAZORPAY_KEY_SECRET) ||
    hasNonEmpty(raw.RAZORPAY_WEBHOOK_SECRET)
  );
}

function isValidCredentialsEncryptionKey(value: string): boolean {
  try {
    const key = Buffer.from(value, "base64");
    return key.length === 32;
  } catch {
    return false;
  }
}

/**
 * Validates environment variables. In production, fails closed when
 * CRON_SECRET or CREDENTIALS_ENCRYPTION_KEY are missing/invalid, and when
 * billing is enabled without complete Razorpay credentials.
 */
export function parseEnv(
  raw: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): Env {
  const parsed = baseEnvSchema.safeParse(raw);

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid environment variables:\n${formatted}`);
  }

  const env = parsed.data;
  const issues: string[] = [];

  if (env.NODE_ENV === "production") {
    if (!hasNonEmpty(env.CRON_SECRET)) {
      issues.push(
        "CRON_SECRET is required in production (protects cron and worker drain routes)",
      );
    }

    if (!hasNonEmpty(env.CREDENTIALS_ENCRYPTION_KEY)) {
      issues.push(
        "CREDENTIALS_ENCRYPTION_KEY is required in production (encrypts channel credentials)",
      );
    } else if (
      !isValidCredentialsEncryptionKey(env.CREDENTIALS_ENCRYPTION_KEY!)
    ) {
      issues.push(
        "CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
      );
    }

    if (isBillingConfigured(raw)) {
      if (!hasNonEmpty(env.RAZORPAY_KEY_ID)) {
        issues.push(
          "RAZORPAY_KEY_ID is required when billing is enabled in production",
        );
      }
      if (!hasNonEmpty(env.RAZORPAY_KEY_SECRET)) {
        issues.push(
          "RAZORPAY_KEY_SECRET is required when billing is enabled in production",
        );
      }
      if (!hasNonEmpty(env.RAZORPAY_WEBHOOK_SECRET)) {
        issues.push(
          "RAZORPAY_WEBHOOK_SECRET is required when billing is enabled in production",
        );
      }
    }
  }

  if (issues.length > 0) {
    throw new Error(
      `Invalid environment variables (production fail-closed):\n${issues.join("\n")}`,
    );
  }

  return env;
}

/**
 * Next sets NODE_ENV=production during `next build`. Skip strict fail-closed
 * at import time in that phase; runtime instrumentation still calls parseEnv().
 */
function loadEnvForModule(): Env {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return baseEnvSchema.parse({
      NODE_ENV: process.env.NODE_ENV ?? "production",
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://127.0.0.1:5432/next_build_placeholder",
    });
  }

  return parseEnv();
}

export const env = loadEnvForModule();
