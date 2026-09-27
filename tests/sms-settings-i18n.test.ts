import { describe, expect, it } from "vitest";

import { getSmsSettingsDict } from "@/lib/i18n/dictionaries/sms-settings";
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

describe("sms settings i18n", () => {
  it("every string leaf is non-empty across all locales", () => {
    for (const locale of LOCALES) {
      checkStrings(getSmsSettingsDict(locale), `smsSettings.${locale}`);
    }
  });

  it("hi/mr contain Devanagari script", () => {
    const hi = getSmsSettingsDict("hi");
    const mr = getSmsSettingsDict("mr");

    expect(hi.list.heading).toMatch(DEVANAGARI_PATTERN);
    expect(hi.setup.heading).toMatch(DEVANAGARI_PATTERN);

    expect(mr.list.heading).toMatch(DEVANAGARI_PATTERN);
    expect(mr.setup.heading).toMatch(DEVANAGARI_PATTERN);
  });

  it("English defaults match the original hardcoded strings", () => {
    const dict = getSmsSettingsDict("en");
    expect(dict.list.heading).toBe("Advanced SMS Template Setup");
    expect(dict.list.addApprovedTemplate).toBe("Add approved DLT template");
    expect(dict.setup.heading).toBe("Advanced SMS Setup");
    expect(dict.setup.saveAction).toBe("Save SMS setup");
  });
});
