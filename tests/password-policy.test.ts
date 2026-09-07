import { describe, expect, it } from "vitest";

import {
  STRONG_PASSWORD_MESSAGE,
  isStrongPassword,
} from "@/lib/auth/password-policy";
import { registerSchema, resetPasswordSchema } from "@/lib/validation/auth";

describe("password policy", () => {
  it("accepts passwords of length >= 10", () => {
    expect(isStrongPassword("password12")).toBe(true);
    expect(isStrongPassword("abcdefghij")).toBe(true);
  });

  it("accepts 8+ with upper, lower, and number", () => {
    expect(isStrongPassword("Abcdefg1")).toBe(true);
  });

  it("rejects short weak passwords", () => {
    expect(isStrongPassword("short")).toBe(false);
    expect(isStrongPassword("abcdefgh")).toBe(false);
    expect(isStrongPassword("ABCDEFG1")).toBe(false);
    expect(isStrongPassword("abcdefg1")).toBe(false);
  });

  it("applies on register and reset schemas", () => {
    expect(
      registerSchema.safeParse({
        organizationName: "Acme",
        organizationSlug: "acme",
        timezone: "UTC",
        adminName: "Ada",
        email: "ada@example.com",
        password: "short",
      }).success,
    ).toBe(false);

    expect(
      resetPasswordSchema.safeParse({
        token: "a".repeat(40),
        password: "short",
      }).success,
    ).toBe(false);

    expect(
      resetPasswordSchema.safeParse({
        token: "a".repeat(40),
        password: "password12",
      }).success,
    ).toBe(true);

    expect(STRONG_PASSWORD_MESSAGE.length).toBeGreaterThan(10);
  });
});
