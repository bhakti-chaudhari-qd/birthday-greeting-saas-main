import { describe, expect, it } from "vitest";

import { getPlatformSmsConfig } from "@/lib/env";

const configured = {
  NODE_ENV: "production",
  PLATFORM_APP_URL: "https://app.example.test",
  PLATFORM_SMS_BASE_URL: "https://sms.example.test",
  PLATFORM_SMS_SEND_PATH: "/send.aspx",
  PLATFORM_SMS_USERNAME: "platform-user",
  PLATFORM_SMS_PASSWORD: "secret",
  PLATFORM_SMS_ROUTE: "trans1",
  PLATFORM_SMS_SENDER_ID: "BIRTHD",
  PLATFORM_SMS_DLT_TEMPLATE_ID: "1707000000000000000",
  PLATFORM_SMS_INVITATION_BODY_TEMPLATE:
    "Register at {{registrationUrl}} for {{vendorName}}.",
};

describe("platform SMS configuration", () => {
  it("resolves the dedicated provider settings", () => {
    expect(getPlatformSmsConfig(configured)).toMatchObject({
      appUrl: "https://app.example.test/",
      baseUrl: "https://sms.example.test/",
      sendPath: "/send.aspx",
      username: "platform-user",
      dltTemplateId: "1707000000000000000",
    });
  });

  it("fails closed outside test when any setting is missing", () => {
    const incomplete = { ...configured, PLATFORM_SMS_PASSWORD: "" };
    expect(() => getPlatformSmsConfig(incomplete)).toThrow(
      /PLATFORM_SMS_PASSWORD/,
    );
  });

  it("allows tests to inject a sender without platform credentials", () => {
    expect(getPlatformSmsConfig({ NODE_ENV: "test" })).toBeNull();
  });

  it.each(["PLATFORM_APP_URL", "PLATFORM_SMS_BASE_URL"] as const)(
    "rejects an insecure production %s",
    (key) => {
      expect(() =>
        getPlatformSmsConfig({ ...configured, [key]: "http://example.test" }),
      ).toThrow(/must use https in production/);
    },
  );

  it("allows local HTTP endpoints outside production", () => {
    expect(
      getPlatformSmsConfig({
        ...configured,
        NODE_ENV: "development",
        PLATFORM_APP_URL: "http://localhost:3000",
        PLATFORM_SMS_BASE_URL: "http://localhost:4000",
      }),
    ).toMatchObject({
      appUrl: "http://localhost:3000/",
      baseUrl: "http://localhost:4000/",
    });
  });
});
