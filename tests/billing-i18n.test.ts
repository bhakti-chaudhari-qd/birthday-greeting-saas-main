import { describe, expect, it } from "vitest";

import { getBillingDict } from "@/lib/i18n/dictionaries/billing";
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

describe("billing i18n", () => {
  it("every string leaf is non-empty across all locales", () => {
    for (const locale of LOCALES) {
      checkStrings(getBillingDict(locale), `billing.${locale}`);
    }
  });

  it("hi/mr contain Devanagari script", () => {
    const hi = getBillingDict("hi");
    const mr = getBillingDict("mr");

    expect(hi.page.title).toMatch(DEVANAGARI_PATTERN);
    expect(hi.currentPlan.heading).toMatch(DEVANAGARI_PATTERN);
    expect(hi.plans.heading).toMatch(DEVANAGARI_PATTERN);

    expect(mr.page.title).toMatch(DEVANAGARI_PATTERN);
    expect(mr.currentPlan.heading).toMatch(DEVANAGARI_PATTERN);
    expect(mr.plans.heading).toMatch(DEVANAGARI_PATTERN);
  });

  it("interpolated values appear in generated strings", () => {
    for (const locale of LOCALES) {
      const dict = getBillingDict(locale);
      expect(dict.currentPlan.includesBonusCredits("500")).toContain("500");
      expect(dict.currentPlan.sendingBlocked("PAUSED")).toContain("paused");
      expect(dict.plans.upgradeTo("Pro")).toContain("Pro");
      expect(dict.errors.planActiveNow("Pro")).toContain("Pro");
      expect(dict.errors.creditsAdded("500")).toContain("500");
    }
  });

  it("English defaults match the original hardcoded strings", () => {
    const dict = getBillingDict("en");
    expect(dict.page.title).toBe("Billing");
    expect(dict.loading).toBe("Loading billing…");
    expect(dict.plans.currentPlanButton).toBe("Current plan");
  });
});
