import { describe, expect, it } from "vitest";

import { getContactsDict } from "@/lib/i18n/dictionaries/contacts";
import { LOCALES } from "@/lib/i18n/constants";

const DEVANAGARI_PATTERN = /[ऀ-ॿ]/;

describe("contacts i18n: staffVisibility + csvImportDialog", () => {
  it("has non-empty strings across all locales", () => {
    for (const locale of LOCALES) {
      const dict = getContactsDict(locale);
      expect(dict.staffVisibility.title.length).toBeGreaterThan(0);
      expect(dict.csvImportDialog.title.length).toBeGreaterThan(0);
    }
  });

  it("hi/mr contain Devanagari script", () => {
    const hi = getContactsDict("hi");
    const mr = getContactsDict("mr");
    expect(hi.staffVisibility.title).toMatch(DEVANAGARI_PATTERN);
    expect(hi.csvImportDialog.title).toMatch(DEVANAGARI_PATTERN);
    expect(mr.staffVisibility.title).toMatch(DEVANAGARI_PATTERN);
    expect(mr.csvImportDialog.title).toMatch(DEVANAGARI_PATTERN);
  });

  it("interpolated values appear correctly", () => {
    for (const locale of LOCALES) {
      const dict = getContactsDict(locale);
      expect(dict.csvImportDialog.rowsDetected("5", "")).toContain("5");
      expect(dict.csvImportDialog.issuesInRows(2, "s")).toContain("2");
      expect(dict.csvImportDialog.showingFirstRows(8, "50")).toContain("8");
      expect(dict.csvImportDialog.showingFirstRows(8, "50")).toContain("50");
    }
  });

  it("English defaults match original hardcoded strings", () => {
    const dict = getContactsDict("en");
    expect(dict.staffVisibility.toggleLabel).toBe(
      "Staff can view full details of contacts admin added for us",
    );
    expect(dict.csvImportDialog.title).toBe("Import CSV");
    expect(dict.csvImportDialog.downloadSample).toBe("Download Sample CSV");
  });
});
