import { describe, expect, it } from "vitest";

import { addOrganizationUserRequestSchema } from "@/lib/admin/add-organization-user";
import { normalizeAccountNumbers } from "@/lib/auth/register";
import { updatePlatformDailySummarySchema } from "@/lib/daily-summary/platform-config";
import { buildDailySummaryParameters } from "@/lib/daily-summary/service";
import { signupSchema } from "@/lib/validation/auth";

describe("updatePlatformDailySummarySchema", () => {
  const valid = {
    enabled: true,
    accessToken: "token",
    phoneNumberId: "1320947411098948",
    templateName: "daily_summary",
    language: "en",
    sendHour: 9,
  };

  it("accepts a complete config, with or without a new token", () => {
    expect(updatePlatformDailySummarySchema.safeParse(valid).success).toBe(true);
    expect(
      updatePlatformDailySummarySchema.safeParse({ ...valid, accessToken: undefined })
        .success,
    ).toBe(true);
  });

  it("rejects a bad template name, language or hour", () => {
    for (const bad of [
      { templateName: "Daily Summary" },
      { language: "english" },
      { sendHour: 24 },
      { phoneNumberId: "+91 98765" },
    ]) {
      expect(
        updatePlatformDailySummarySchema.safeParse({ ...valid, ...bad }).success,
      ).toBe(false);
    }
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
