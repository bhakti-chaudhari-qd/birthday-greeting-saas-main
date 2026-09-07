import { describe, expect, it } from "vitest";

import { isBillingConfigured, parseEnv } from "@/lib/env";
import { assertSeedAllowed } from "@/lib/ops/seed-guard";

const validEncryptionKey = Buffer.alloc(32, 7).toString("base64");

const baseDev = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
} as const;

const baseProd = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/test",
  CRON_SECRET: "cron-secret-at-least-32-chars-long!!",
  CREDENTIALS_ENCRYPTION_KEY: validEncryptionKey,
} as const;

describe("parseEnv", () => {
  it("accepts valid development environment values", () => {
    const parsed = parseEnv({ ...baseDev });

    expect(parsed.NODE_ENV).toBe("development");
    expect(parsed.DATABASE_URL).toContain("postgresql://");
  });

  it("rejects missing DATABASE_URL", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "development",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("allows missing CRON_SECRET and encryption key outside production", () => {
    const parsed = parseEnv({ ...baseDev });
    expect(parsed.CRON_SECRET).toBeUndefined();
    expect(parsed.CREDENTIALS_ENCRYPTION_KEY).toBeUndefined();
  });

  it("fails closed in production when CRON_SECRET is missing", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: baseProd.DATABASE_URL,
        CREDENTIALS_ENCRYPTION_KEY: validEncryptionKey,
      }),
    ).toThrow(/CRON_SECRET/);
  });

  it("fails closed in production when CREDENTIALS_ENCRYPTION_KEY is missing", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: baseProd.DATABASE_URL,
        CRON_SECRET: baseProd.CRON_SECRET,
      }),
    ).toThrow(/CREDENTIALS_ENCRYPTION_KEY/);
  });

  it("fails closed in production when encryption key is not 32 bytes", () => {
    expect(() =>
      parseEnv({
        ...baseProd,
        CREDENTIALS_ENCRYPTION_KEY: Buffer.from("short").toString("base64"),
      }),
    ).toThrow(/base64-encoded 32-byte/);
  });

  it("accepts production when required secrets are present and billing is off", () => {
    const parsed = parseEnv({ ...baseProd });
    expect(parsed.NODE_ENV).toBe("production");
    expect(parsed.CRON_SECRET).toBe(baseProd.CRON_SECRET);
  });

  it("fails closed in production when billing is enabled without Razorpay keys", () => {
    expect(() =>
      parseEnv({
        ...baseProd,
        BILLING_ENABLED: "true",
      }),
    ).toThrow(/RAZORPAY_KEY_ID/);
  });

  it("fails closed in production when a partial Razorpay key is set", () => {
    expect(() =>
      parseEnv({
        ...baseProd,
        RAZORPAY_KEY_ID: "rzp_test_xxx",
      }),
    ).toThrow(/RAZORPAY_KEY_SECRET/);
  });

  it("accepts production with complete Razorpay credentials when billing is enabled", () => {
    const parsed = parseEnv({
      ...baseProd,
      BILLING_ENABLED: "true",
      RAZORPAY_KEY_ID: "rzp_test_xxx",
      RAZORPAY_KEY_SECRET: "secret",
      RAZORPAY_WEBHOOK_SECRET: "whsec",
    });

    expect(parsed.RAZORPAY_KEY_ID).toBe("rzp_test_xxx");
  });
});

describe("isBillingConfigured", () => {
  it("is true when BILLING_ENABLED is set", () => {
    expect(isBillingConfigured({ BILLING_ENABLED: "true" })).toBe(true);
  });

  it("is true when any Razorpay key is present", () => {
    expect(isBillingConfigured({ RAZORPAY_KEY_ID: "rzp_test" })).toBe(true);
  });

  it("is false when billing flags and keys are absent", () => {
    expect(isBillingConfigured({})).toBe(false);
  });
});

describe("assertSeedAllowed", () => {
  it("allows development and test", () => {
    expect(() => assertSeedAllowed("development")).not.toThrow();
    expect(() => assertSeedAllowed("test")).not.toThrow();
    expect(() => assertSeedAllowed(undefined)).not.toThrow();
  });

  it("refuses production", () => {
    expect(() => assertSeedAllowed("production")).toThrow(
      /Refusing to run database seed/,
    );
  });
});
