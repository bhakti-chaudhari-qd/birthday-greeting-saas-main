import { describe, expect, it } from "vitest";

import { withUtf8Bom } from "@/lib/csv-response";

describe("withUtf8Bom", () => {
  it("prefixes a UTF-8 BOM so Excel reads Devanagari correctly", () => {
    const bytes = Buffer.from(withUtf8Bom("नाम,फ़ोन\nभक्ति,9876543210"), "utf8");
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.subarray(3).toString("utf8")).toBe("नाम,फ़ोन\nभक्ति,9876543210");
  });

  it("does not add a second BOM", () => {
    expect(withUtf8Bom(withUtf8Bom("a,b"))).toBe("\uFEFFa,b");
  });
});
