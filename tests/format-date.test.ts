import { describe, expect, it } from "vitest";

import { formatLongDate } from "@/lib/i18n/format-date";

describe("formatLongDate", () => {
  it("formats in English for en", () => {
    expect(formatLongDate("2026-07-17", "en")).toBe("Friday, 17 July 2026");
  });

  it("formats weekday/month in Devanagari for hi, keeping Arabic digits", () => {
    const result = formatLongDate("2026-07-17", "hi");
    expect(result).toContain("17");
    expect(result).toContain("2026");
    expect(result).toMatch(/[ऀ-ॿ]/);
  });

  it("formats weekday/month in Devanagari for mr, keeping Arabic digits", () => {
    const result = formatLongDate("2026-07-17", "mr");
    expect(result).toContain("17");
    expect(result).toContain("2026");
    expect(result).toMatch(/[ऀ-ॿ]/);
  });

  it("is deterministic for the same input", () => {
    expect(formatLongDate("2026-01-01", "hi")).toBe(
      formatLongDate("2026-01-01", "hi"),
    );
  });
});
