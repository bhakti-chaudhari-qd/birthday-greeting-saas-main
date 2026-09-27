import { describe, expect, it } from "vitest";

import { getDocumentTemplatesDict } from "@/lib/i18n/dictionaries/document-templates";
import { LOCALES } from "@/lib/i18n/constants";

const DEVANAGARI_PATTERN = /[ऀ-ॿ]/;

function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") {
    acc.push(value);
  } else if (typeof value === "function") {
    // Functions are exercised separately with representative arguments.
  } else if (value && typeof value === "object") {
    for (const nested of Object.values(value)) {
      collectStrings(nested, acc);
    }
  }
  return acc;
}

describe("document-templates i18n", () => {
  it("has non-empty strings across all locales", () => {
    for (const locale of LOCALES) {
      const dict = getDocumentTemplatesDict(locale);
      const strings = collectStrings(dict);
      expect(strings.length).toBeGreaterThan(0);
      for (const value of strings) {
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it("hi/mr contain Devanagari script across namespaces", () => {
    for (const locale of ["hi", "mr"] as const) {
      const dict = getDocumentTemplatesDict(locale);
      expect(dict.pageList.title).toMatch(DEVANAGARI_PATTERN);
      expect(dict.pageList.confirmDelete("x")).toMatch(DEVANAGARI_PATTERN);
      expect(dict.editor.loadingEditor).toMatch(DEVANAGARI_PATTERN);
      expect(dict.toolbar.hint).toMatch(DEVANAGARI_PATTERN);
      expect(dict.generatePanel.title).toMatch(DEVANAGARI_PATTERN);
      expect(dict.pdfViewer.loading).toMatch(DEVANAGARI_PATTERN);
      expect(dict.textBox.deleteAria).toMatch(DEVANAGARI_PATTERN);
      expect(dict.typographyPanel.formatLabel).toMatch(DEVANAGARI_PATTERN);
      expect(dict.typographyPanel.alignAria("Left")).toMatch(DEVANAGARI_PATTERN);
      expect(dict.variablePanel.insertPrompt).toMatch(DEVANAGARI_PATTERN);
    }
  });

  it("hi and mr are genuinely distinct translations", () => {
    const hi = getDocumentTemplatesDict("hi");
    const mr = getDocumentTemplatesDict("mr");
    expect(hi.pageList.title).not.toBe(mr.pageList.title);
    expect(hi.generatePanel.hint).not.toBe(mr.generatePanel.hint);
    expect(hi.typographyPanel.alignLeft).not.toBe(mr.typographyPanel.alignLeft);
  });

  it("interpolated values appear correctly", () => {
    for (const locale of LOCALES) {
      const dict = getDocumentTemplatesDict(locale);
      expect(dict.pageList.confirmDelete("Birthday Card")).toContain(
        "Birthday Card",
      );
      expect(dict.typographyPanel.alignAria("Left").toLowerCase()).toContain(
        "left",
      );
      expect(dict.typographyPanel.alignAria("Center").toLowerCase()).toContain(
        "center",
      );
    }
  });

  it("English defaults match original hardcoded strings", () => {
    const dict = getDocumentTemplatesDict("en");
    expect(dict.pageList.title).toBe("Document Templates");
    expect(dict.pageList.generatedDocuments).toBe("Generated Documents");
    expect(dict.pageList.confirmDelete("Birthday Card")).toBe(
      'Delete "Birthday Card"? This cannot be undone.',
    );
    expect(dict.editor.defaultTemplateName).toBe("Document Template");
    expect(dict.toolbar.saveLayout).toBe("Save Layout");
    expect(dict.generatePanel.generate).toBe("Generate PDF");
    expect(dict.pdfViewer.couldNotLoad).toBe("Could not load this PDF.");
    expect(dict.textBox.deleteAria).toBe("Delete text box");
    expect(dict.typographyPanel.alignAria("Left")).toBe("Align left");
    expect(dict.variablePanel.insertPrompt).toBe("Insert variable:");
  });
});
