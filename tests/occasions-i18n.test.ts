import { describe, expect, it } from "vitest";

import { getOccasionsDict } from "@/lib/i18n/dictionaries/occasions";
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

describe("occasions i18n", () => {
  it("every string leaf is non-empty across all locales", () => {
    for (const locale of LOCALES) {
      checkStrings(getOccasionsDict(locale), `occasions.${locale}`);
    }
  });

  it("hi/mr contain Devanagari script", () => {
    const hi = getOccasionsDict("hi");
    const mr = getOccasionsDict("mr");

    expect(hi.manage.title).toMatch(DEVANAGARI_PATTERN);
    expect(hi.form.addOccasionTitle).toMatch(DEVANAGARI_PATTERN);
    expect(hi.deleteDialog.title).toMatch(DEVANAGARI_PATTERN);
    expect(hi.list.today).toMatch(DEVANAGARI_PATTERN);

    expect(mr.manage.title).toMatch(DEVANAGARI_PATTERN);
    expect(mr.form.addOccasionTitle).toMatch(DEVANAGARI_PATTERN);
    expect(mr.deleteDialog.title).toMatch(DEVANAGARI_PATTERN);
    expect(mr.list.today).toMatch(DEVANAGARI_PATTERN);
  });

  it("interpolated values appear in generated strings", () => {
    for (const locale of LOCALES) {
      const dict = getOccasionsDict(locale);
      expect(dict.deleteDialog.confirmText("Diwali")).toContain("Diwali");
      expect(dict.list.sendAfter("9:00 AM")).toContain("9:00 AM");
      expect(dict.list.noItemsForDate("24 Sep")).toContain("24 sep");
      expect(dict.list.inGroup("Family")).toContain("Family");
      expect(dict.list.pageOf(2, 5, 40)).toContain("2");
    }
  });

  it("English defaults match the original hardcoded strings", () => {
    const dict = getOccasionsDict("en");
    expect(dict.manage.addOccasion).toBe("+ Add Occasion");
    expect(dict.form.cancel).toBe("Cancel");
    expect(dict.deleteDialog.deleteAction).toBe("Delete");
    expect(dict.list.today).toBe("today");
  });
});
