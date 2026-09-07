import { describe, expect, it } from "vitest";

import { patchElementById } from "@/components/document-templates/document-editor-page-client";
import type { LayoutTextElement } from "@/lib/validation/document-template-layout";

function element(overrides: Partial<LayoutTextElement> = {}): LayoutTextElement {
  return {
    id: "el-1",
    type: "text",
    x: 0.1,
    y: 0.1,
    width: 0.5,
    text: "Hello",
    fontSize: 16,
    color: "#000000",
    ...overrides,
  };
}

describe("patchElementById (editor typography state)", () => {
  it("applies a typography patch only to the matching element", () => {
    const elements = [
      element({ id: "el-1", text: "First" }),
      element({ id: "el-2", text: "Second" }),
    ];

    const next = patchElementById(elements, "el-1", { fontWeight: "bold" });

    expect(next[0]).toMatchObject({ id: "el-1", fontWeight: "bold" });
    expect(next[1]).toEqual(elements[1]);
    expect(next[1]!.fontWeight).toBeUndefined();
  });

  it("leaves the array unchanged in length and order", () => {
    const elements = [
      element({ id: "el-1" }),
      element({ id: "el-2" }),
      element({ id: "el-3" }),
    ];

    const next = patchElementById(elements, "el-2", { textAlign: "center" });

    expect(next.map((item) => item.id)).toEqual(["el-1", "el-2", "el-3"]);
  });

  it("does not mutate the original elements or array", () => {
    const original = element({ fontWeight: "normal" });
    const elements = [original];

    const next = patchElementById(elements, "el-1", { fontWeight: "bold" });

    expect(original.fontWeight).toBe("normal");
    expect(elements[0]).toBe(original);
    expect(next).not.toBe(elements);
    expect(next[0]).not.toBe(original);
  });

  it("preserves untouched properties (like text and variables) when applying a typography patch", () => {
    const elements = [element({ text: "Happy Birthday {{name}}!" })];

    const next = patchElementById(elements, "el-1", {
      fontWeight: "bold",
      fontStyle: "italic",
    });

    expect(next[0]!.text).toBe("Happy Birthday {{name}}!");
    expect(next[0]!.fontWeight).toBe("bold");
    expect(next[0]!.fontStyle).toBe("italic");
  });

  it("merges multiple typography properties in one patch", () => {
    const elements = [element()];

    const next = patchElementById(elements, "el-1", {
      fontWeight: "bold",
      fontStyle: "italic",
      textDecoration: "underline",
      textAlign: "right",
      fontSize: 22,
      color: "#ff0000",
    });

    expect(next[0]).toMatchObject({
      fontWeight: "bold",
      fontStyle: "italic",
      textDecoration: "underline",
      textAlign: "right",
      fontSize: 22,
      color: "#ff0000",
    });
  });

  it("returns the same array reference when the id does not match anything", () => {
    const elements = [element({ id: "el-1" })];
    const next = patchElementById(elements, "does-not-exist", {
      fontWeight: "bold",
    });

    expect(next[0]).toEqual(elements[0]);
  });
});
