import { describe, expect, it } from "vitest";

import { addOrganizationUserRequestSchema } from "@/lib/admin/add-organization-user";
import { normalizeAccountNumbers } from "@/lib/auth/register";
import {
  buildDailySummaryParameters,
  readDailySummaryConfig,
} from "@/lib/daily-summary/service";
import { signupSchema } from "@/lib/validation/auth";

describe("readDailySummaryConfig", () => {
  const meta = {
    DAILY_SUMMARY_META_ACCESS_TOKEN: "token",
    DAILY_SUMMARY_META_PHONE_NUMBER_ID: "12345",
  };

  it("is off until the Meta account and template are all set", () => {
    expect(readDailySummaryConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(readDailySummaryConfig(meta as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(
      readDailySummaryConfig({
        DAILY_SUMMARY_WHATSAPP_TEMPLATE: "daily_summary",
      } as unknown as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("defaults the language and send hour", () => {
    expect(
      readDailySummaryConfig({
        ...meta,
        DAILY_SUMMARY_WHATSAPP_TEMPLATE: "daily_summary",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({
      accessToken: "token",
      phoneNumberId: "12345",
      apiVersion: "v21.0",
      templateName: "daily_summary",
      language: "en",
      sendHour: 9,
    });
  });

  it("ignores an out-of-range send hour", () => {
    expect(
      readDailySummaryConfig({
        ...meta,
        DAILY_SUMMARY_WHATSAPP_TEMPLATE: "daily_summary",
        DAILY_SUMMARY_SEND_HOUR: "42",
      } as unknown as NodeJS.ProcessEnv)?.sendHour,
    ).toBe(9);
  });
});

describe("buildDailySummaryParameters", () => {
  it("lists name, date, then sent/failed for WhatsApp, SMS and Email", () => {
    expect(
      buildDailySummaryParameters("Acme", "2026-10-08", {
        WHATSAPP: { sent: 12, failed: 1 },
        SMS: { sent: 3, failed: 0 },
        EMAIL: { sent: 0, failed: 2 },
      }),
    ).toEqual(["Acme", "8 Oct 2026", "12", "1", "3", "0", "0", "2"]);
  });
});

describe("mandatory mobile and WhatsApp number", () => {
  const signup = {
    organizationName: "Acme",
    adminName: "Asha",
    email: "asha@example.com",
    password: "password12345",
  };

  it("rejects a signup missing either number", () => {
    expect(signupSchema.safeParse(signup).success).toBe(false);
    expect(
      signupSchema.safeParse({ ...signup, mobile: "9876543210" }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ ...signup, whatsappNumber: "9876543210" }).success,
    ).toBe(false);
  });

  it("accepts a signup with both numbers and rejects a malformed one", () => {
    expect(
      signupSchema.safeParse({
        ...signup,
        mobile: "9876543210",
        whatsappNumber: "+91 91234 56780",
      }).success,
    ).toBe(true);
    expect(
      signupSchema.safeParse({
        ...signup,
        mobile: "9876543210",
        whatsappNumber: "12345",
      }).success,
    ).toBe(false);
  });

  it("requires both numbers when an admin adds a user", () => {
    const user = { name: "Staff", email: "s@example.com", password: "password12345" };
    expect(addOrganizationUserRequestSchema.safeParse(user).success).toBe(false);
    expect(
      addOrganizationUserRequestSchema.safeParse({
        ...user,
        mobile: "9876543210",
        whatsappNumber: "9876543210",
      }).success,
    ).toBe(true);
  });

  it("normalizes both numbers and defaults WhatsApp to the mobile", () => {
    expect(
      normalizeAccountNumbers({
        mobile: "+91 98765 43210",
        whatsappNumber: "09123456780",
      }),
    ).toEqual({ mobile: "9876543210", whatsappNumber: "9123456780" });
    expect(normalizeAccountNumbers({ mobile: "9876543210" })).toEqual({
      mobile: "9876543210",
      whatsappNumber: "9876543210",
    });
  });
});
