import { describe, expect, it } from "vitest";

import { getGreetingRoutesDict } from "@/lib/i18n/dictionaries/greeting-routes";
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

describe("greeting-routes automation namespaces i18n", () => {
  it("every string leaf is non-empty across all locales", () => {
    for (const locale of LOCALES) {
      const dict = getGreetingRoutesDict(locale);
      checkStrings(dict.card, `greetingRoutes.${locale}.card`);
      checkStrings(dict.drawer, `greetingRoutes.${locale}.drawer`);
      checkStrings(dict.categoryMultiSelect, `greetingRoutes.${locale}.categoryMultiSelect`);
      checkStrings(dict.manualQuickSend, `greetingRoutes.${locale}.manualQuickSend`);
      checkStrings(dict.quickCreateTemplate, `greetingRoutes.${locale}.quickCreateTemplate`);
      checkStrings(dict.sendMessagesPage, `greetingRoutes.${locale}.sendMessagesPage`);
    }
  });

  it("hi/mr contain Devanagari script", () => {
    const hi = getGreetingRoutesDict("hi");
    const mr = getGreetingRoutesDict("mr");

    expect(hi.manualQuickSend.heading).toMatch(DEVANAGARI_PATTERN);
    expect(hi.quickCreateTemplate.cancel).toMatch(DEVANAGARI_PATTERN);
    expect(hi.sendMessagesPage.title).toMatch(DEVANAGARI_PATTERN);

    expect(mr.manualQuickSend.heading).toMatch(DEVANAGARI_PATTERN);
    expect(mr.quickCreateTemplate.cancel).toMatch(DEVANAGARI_PATTERN);
    expect(mr.sendMessagesPage.title).toMatch(DEVANAGARI_PATTERN);
  });

  it("interpolated values appear in generated strings", () => {
    for (const locale of LOCALES) {
      const dict = getGreetingRoutesDict(locale);
      expect(dict.manualQuickSend.categoriesSelectedCount(3)).toContain("3");
      expect(dict.manualQuickSend.contactsCount(5)).toContain("5");
      expect(dict.manualQuickSend.errorSendChannel("SMS")).toContain("SMS");
      expect(dict.manualQuickSend.sentSummary(4, "2 via SMS")).toContain("4");
      expect(dict.quickCreateTemplate.newMessageTitle("Birthday", "SMS")).toContain("Birthday");
      expect(dict.sendMessagesPage.confirmDelete("Diwali")).toContain("Diwali");
    }
  });

  it("English defaults match the original hardcoded strings", () => {
    const dict = getGreetingRoutesDict("en");
    expect(dict.card.edit).toBe("Edit");
    expect(dict.manualQuickSend.heading).toBe("Send Now");
    expect(dict.quickCreateTemplate.cancel).toBe("Cancel");
    expect(dict.sendMessagesPage.title).toBe("Send Messages");
  });
});
