import { describe, expect, it } from "vitest";

import { getChannelSettingsDict } from "@/lib/i18n/dictionaries/channel-settings";
import { LOCALES } from "@/lib/i18n/constants";

const DEVANAGARI_PATTERN = /[ऀ-ॿ]/;

function checkStrings(value: unknown, path: string): void {
  if (typeof value === "string") {
    expect(value.length, `${path} should not be empty`).toBeGreaterThan(0);
    return;
  }
  if (typeof value === "function") {
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      checkStrings(entry, `${path}.${key}`);
    }
  }
}

describe("channel settings i18n", () => {
  it("every string leaf is non-empty across all locales", () => {
    for (const locale of LOCALES) {
      checkStrings(getChannelSettingsDict(locale), `channelSettings.${locale}`);
    }
  });

  it("hi/mr contain Devanagari script", () => {
    const hi = getChannelSettingsDict("hi");
    const mr = getChannelSettingsDict("mr");

    expect(hi.page.title).toMatch(DEVANAGARI_PATTERN);
    expect(hi.sms.gateway).toMatch(DEVANAGARI_PATTERN);
    expect(hi.whatsapp.gateway).toMatch(DEVANAGARI_PATTERN);
    expect(hi.email.fromEmail === "From email").toBe(true); // channel-neutral field name kept as-is

    expect(mr.page.title).toMatch(DEVANAGARI_PATTERN);
    expect(mr.sms.gateway).toMatch(DEVANAGARI_PATTERN);
    expect(mr.whatsapp.gateway).toMatch(DEVANAGARI_PATTERN);
  });

  it("interpolated values appear in generated strings", () => {
    for (const locale of LOCALES) {
      const dict = getChannelSettingsDict(locale);
      expect(dict.whatsapp.currentStatusConfigured("Meta Cloud API", "active")).toContain(
        "Meta Cloud API",
      );
      expect(dict.email.notConfiguredDefault("noreply@x.in")).toContain(
        "noreply@x.in",
      );
      expect(dict.sms.enterGatewayDetails(" note")).toContain("note");
      expect(dict.sms.routeHint(" demo")).toContain("demo");
      expect(dict.sms.balanceCreditsLine("1,250")).toContain("1,250");
      expect(dict.sms.verifiedWithBalance("1,250")).toContain("1,250");
      expect(dict.common.changeSecret("API Key")).toContain("API Key");
      expect(dict.common.newSecret("API Key")).toContain("API Key");
    }
  });

  it("password field and SMS balance/verify messages are translated in hi/mr", () => {
    for (const locale of ["hi", "mr"] as const) {
      const dict = getChannelSettingsDict(locale);
      expect(dict.common.password).toMatch(DEVANAGARI_PATTERN);
      expect(dict.common.cancel).toMatch(DEVANAGARI_PATTERN);
      expect(dict.common.changeSecret(dict.common.password)).toMatch(DEVANAGARI_PATTERN);
      expect(dict.page.channelTabsLabel).toMatch(DEVANAGARI_PATTERN);
      expect(dict.sms.balanceNoCredits).toMatch(DEVANAGARI_PATTERN);
      expect(dict.sms.balanceCreditsLine("5")).toMatch(DEVANAGARI_PATTERN);
      expect(dict.sms.testProviderReady).toMatch(DEVANAGARI_PATTERN);
      expect(dict.sms.verifiedSuccess).toMatch(DEVANAGARI_PATTERN);
      expect(dict.sms.verifiedWithBalance("5")).toMatch(DEVANAGARI_PATTERN);
    }
  });

  it("English defaults match the original hardcoded strings", () => {
    const dict = getChannelSettingsDict("en");
    expect(dict.page.title).toBe("Channels");
    expect(dict.common.saveConfiguration).toBe("Save Configuration");
    expect(dict.sms.gateway).toBe("SMS gateway");
    expect(dict.whatsapp.gateway).toBe("WhatsApp gateway");
    expect(dict.email.emailService).toBe("Email service");
    expect(dict.common.password).toBe("Password");
    expect(dict.common.changeSecret("Password")).toBe("Change Password");
    expect(dict.common.newSecret("API Key")).toBe("New API Key");
    expect(dict.page.channelTabsLabel).toBe("Channel");
  });
});
