import { describe, expect, it } from "vitest";

import { getDeliveriesDict } from "@/lib/i18n/dictionaries/deliveries";
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

describe("deliveries i18n", () => {
  it("every string leaf is non-empty across all locales", () => {
    for (const locale of LOCALES) {
      checkStrings(getDeliveriesDict(locale), `deliveries.${locale}`);
    }
  });

  it("hi/mr contain Devanagari script", () => {
    const hi = getDeliveriesDict("hi");
    const mr = getDeliveriesDict("mr");

    expect(hi.deliveries.pageTitle).toMatch(DEVANAGARI_PATTERN);
    expect(hi.deliveries.statusLabel).toMatch(DEVANAGARI_PATTERN);
    expect(hi.generatedDocuments.pageTitle).toMatch(DEVANAGARI_PATTERN);

    expect(mr.deliveries.pageTitle).toMatch(DEVANAGARI_PATTERN);
    expect(mr.deliveries.statusLabel).toMatch(DEVANAGARI_PATTERN);
    expect(mr.generatedDocuments.pageTitle).toMatch(DEVANAGARI_PATTERN);
  });

  it("hi and mr are genuinely distinct translations", () => {
    const hi = getDeliveriesDict("hi");
    const mr = getDeliveriesDict("mr");

    expect(hi.deliveries.pageTitle).not.toBe(mr.deliveries.pageTitle);
    expect(hi.deliveries.emptyDescDefault).not.toBe(mr.deliveries.emptyDescDefault);
    expect(hi.generatedDocuments.pageDescription).not.toBe(
      mr.generatedDocuments.pageDescription,
    );
  });

  it("interpolated values appear in generated strings", () => {
    for (const locale of LOCALES) {
      const dict = getDeliveriesDict(locale);
      expect(dict.deliveries.pageOf(2, 5, 42)).toContain("2");
      expect(dict.deliveries.pageOf(2, 5, 42)).toContain("5");
      expect(dict.deliveries.pageOf(2, 5, 42)).toContain("42");
      expect(dict.generatedDocuments.confirmDelete("photo.pdf")).toContain(
        "photo.pdf",
      );
    }
  });

  it("English defaults match the original hardcoded strings", () => {
    const dict = getDeliveriesDict("en");
    expect(dict.deliveries.pageTitle).toBe("Submitted");
    expect(dict.deliveries.exportReport).toBe("Export report");
    expect(dict.deliveries.viewScheduled).toBe("View Scheduled");
    expect(dict.generatedDocuments.pageTitle).toBe("Generated Documents");
    expect(dict.generatedDocuments.view).toBe("View");
    expect(dict.generatedDocuments.download).toBe("Download");
  });
});
