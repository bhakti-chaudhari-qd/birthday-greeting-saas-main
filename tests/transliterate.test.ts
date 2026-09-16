import { describe, expect, it } from "vitest";

import { toDevanagari } from "@/lib/i18n/transliterate";

describe("toDevanagari", () => {
  it("transliterates simple names to Devanagari script", () => {
    expect(toDevanagari("Ada")).toMatch(/[ऀ-ॿ]/);
    expect(toDevanagari("Priya")).toMatch(/[ऀ-ॿ]/);
    expect(toDevanagari("Rohan")).toMatch(/[ऀ-ॿ]/);
    expect(toDevanagari("Sagar")).toMatch(/[ऀ-ॿ]/);
  });

  it("handles multi-word names, keeping the space", () => {
    const result = toDevanagari("Priya Sharma");
    expect(result).toContain(" ");
    expect(result.split(" ")).toHaveLength(2);
    expect(result.split(" ").every((word) => /[ऀ-ॿ]/.test(word))).toBe(
      true,
    );
  });

  it("is deterministic for the same input", () => {
    expect(toDevanagari("Ananya Mehta")).toBe(toDevanagari("Ananya Mehta"));
  });

  it("falls back to the original string for empty input", () => {
    expect(toDevanagari("")).toBe("");
    expect(toDevanagari("   ")).toBe("   ");
  });

  it("handles consonant clusters without crashing", () => {
    expect(() => toDevanagari("Priya")).not.toThrow();
    expect(() => toDevanagari("Christopher")).not.toThrow();
  });

  it("preserves punctuation like apostrophes and hyphens literally", () => {
    expect(toDevanagari("Anne-Marie")).toContain("-");
  });
});
