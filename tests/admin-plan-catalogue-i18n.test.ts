import { describe, expect, it } from "vitest";

import { getAdminPlanCatalogueDict } from "@/lib/i18n/dictionaries/admin-plan-catalogue";
import { LOCALES } from "@/lib/i18n/constants";

const DEVANAGARI_PATTERN = /[ऀ-ॿ]/;

describe("admin i18n: plan catalogue", () => {
  it("has non-empty strings for every locale", () => {
    for (const locale of LOCALES) {
      const dict = getAdminPlanCatalogueDict(locale);
      expect(dict.title.length).toBeGreaterThan(0);
      expect(dict.saveChanges.length).toBeGreaterThan(0);
      expect(dict.intro("A", "B")).toContain("A");
      expect(dict.intro("A", "B")).toContain("B");
    }
  });

  it("hi/mr contain Devanagari script", () => {
    const hi = getAdminPlanCatalogueDict("hi");
    const mr = getAdminPlanCatalogueDict("mr");
    expect(hi.title).toMatch(DEVANAGARI_PATTERN);
    expect(hi.saveChanges).toMatch(DEVANAGARI_PATTERN);
    expect(mr.title).toMatch(DEVANAGARI_PATTERN);
    expect(mr.saveChanges).toMatch(DEVANAGARI_PATTERN);
  });

  it("interpolated plan name appears in confirm strings", () => {
    for (const locale of LOCALES) {
      const dict = getAdminPlanCatalogueDict(locale);
      expect(dict.confirmTitle("PRO")).toContain("PRO");
      expect(dict.confirmIntro("PRO")).toContain("PRO");
      expect(dict.razorpayPinnedWarning("STARTER")).toContain("STARTER");
      expect(dict.by("Jane")).toContain("Jane");
    }
  });

  it("English defaults match original hardcoded strings", () => {
    const dict = getAdminPlanCatalogueDict("en");
    expect(dict.title).toBe("Plan catalogue");
    expect(dict.saveChanges).toBe("Save changes");
    expect(dict.contactLimit).toBe("Contact limit");
  });
});
