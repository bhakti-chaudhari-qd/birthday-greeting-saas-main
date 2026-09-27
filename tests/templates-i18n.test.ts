import { describe, expect, it } from "vitest";

import { getTemplatesDict } from "@/lib/i18n/dictionaries/templates";
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

describe("templates i18n", () => {
  it("every string leaf is non-empty across all locales", () => {
    for (const locale of LOCALES) {
      checkStrings(getTemplatesDict(locale), `templates.${locale}`);
    }
  });

  it("hi/mr contain Devanagari script", () => {
    const hi = getTemplatesDict("hi");
    const mr = getTemplatesDict("mr");

    expect(hi.page.title).toMatch(DEVANAGARI_PATTERN);
    expect(hi.form.templateName).toMatch(DEVANAGARI_PATTERN);
    expect(hi.deleteButton.title).toMatch(DEVANAGARI_PATTERN);
    expect(hi.newPage.titleSms).toMatch(DEVANAGARI_PATTERN);
    expect(hi.editPage.titleFallback).toMatch(DEVANAGARI_PATTERN);

    expect(mr.page.title).toMatch(DEVANAGARI_PATTERN);
    expect(mr.form.templateName).toMatch(DEVANAGARI_PATTERN);
    expect(mr.deleteButton.title).toMatch(DEVANAGARI_PATTERN);
    expect(mr.newPage.titleSms).toMatch(DEVANAGARI_PATTERN);
    expect(mr.editPage.titleFallback).toMatch(DEVANAGARI_PATTERN);
  });

  it("hi and mr are genuinely distinct translations", () => {
    const hi = getTemplatesDict("hi");
    const mr = getTemplatesDict("mr");

    expect(hi.page.description).not.toBe(mr.page.description);
    expect(hi.form.groupHint).not.toBe(mr.form.groupHint);
    expect(hi.deleteButton.description).not.toBe(mr.deleteButton.description);
  });

  it("interpolated values appear in generated strings", () => {
    for (const locale of LOCALES) {
      const dict = getTemplatesDict(locale);
      expect(dict.page.noMatch("Birthday SMS")).toContain("Birthday SMS");
      expect(dict.page.deleteConfirmText("Birthday SMS")).toContain("Birthday SMS");
      expect(dict.form.mediaSizeError(16)).toContain("16");
      expect(dict.form.addTemplateAction("SMS")).toContain("SMS");
      expect(dict.deleteButton.confirmPrompt("Birthday SMS")).toContain(
        "Birthday SMS",
      );
    }
  });

  it("English defaults match the original hardcoded strings", () => {
    const dict = getTemplatesDict("en");
    expect(dict.page.title).toBe("Manage Templates");
    expect(dict.page.addApprovedTemplate).toBe("+ Add Approved Template");
    expect(dict.variablePicker.addVariable).toBe("Add variable");
    expect(dict.form.templateName).toBe("Template Name");
    expect(dict.deleteButton.title).toBe("Delete template");
    expect(dict.newPage.titleSms).toBe("New SMS template");
    expect(dict.editPage.titleEmail).toBe("Edit Email template");
  });
});
