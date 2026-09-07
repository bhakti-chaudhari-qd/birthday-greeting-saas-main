import { describe, expect, it } from "vitest";

import {
  MAX_LAYOUT_ELEMENT_HEIGHT,
  MIN_LAYOUT_ELEMENT_HEIGHT,
  documentTemplateLayoutSchema,
} from "@/lib/validation/document-template-layout";

function baseElement(overrides: Record<string, unknown> = {}) {
  return {
    id: "el-1",
    type: "text",
    x: 0.1,
    y: 0.1,
    width: 0.5,
    text: "Happy Birthday",
    fontSize: 16,
    color: "#000000",
    ...overrides,
  };
}

function parseElements(elements: unknown[]) {
  return documentTemplateLayoutSchema.safeParse({ elements });
}

describe("document template layout height validation", () => {
  it("accepts a layout with height omitted (auto-height, the pre-existing default)", () => {
    const result = parseElements([baseElement()]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.elements[0]!.height).toBeUndefined();
    }
  });

  it("accepts a valid height", () => {
    const result = parseElements([baseElement({ height: 0.3 })]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.elements[0]!.height).toBe(0.3);
    }
  });

  it("accepts the minimum height", () => {
    const result = parseElements([
      baseElement({ height: MIN_LAYOUT_ELEMENT_HEIGHT }),
    ]);
    expect(result.success).toBe(true);
  });

  it("accepts the maximum height", () => {
    const result = parseElements([
      baseElement({ height: MAX_LAYOUT_ELEMENT_HEIGHT }),
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects a negative height", () => {
    const result = parseElements([baseElement({ height: -0.1 })]);
    expect(result.success).toBe(false);
  });

  it("rejects a zero height", () => {
    const result = parseElements([baseElement({ height: 0 })]);
    expect(result.success).toBe(false);
  });

  it("rejects a height above the maximum", () => {
    const result = parseElements([
      baseElement({ height: MAX_LAYOUT_ELEMENT_HEIGHT + 0.5 }),
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric height", () => {
    const result = parseElements([baseElement({ height: "0.3" })]);
    expect(result.success).toBe(false);
  });

  it("still accepts a pre-height, pre-typography layout exactly as it looked before either feature existed", () => {
    const result = parseElements([
      {
        id: "el-1",
        type: "text",
        x: 0.5,
        y: 0.5,
        width: 0.2,
        text: "Happy Birthday",
        fontSize: 16,
        color: "#000000",
      },
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.elements[0]!.height).toBeUndefined();
      expect(result.data.elements[0]!.fontWeight).toBeUndefined();
    }
  });

  it("accepts height alongside all typography properties together", () => {
    const result = parseElements([
      baseElement({
        height: 0.25,
        fontWeight: "bold",
        fontStyle: "italic",
        textDecoration: "underline",
        textAlign: "center",
      }),
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.elements[0]).toMatchObject({
        height: 0.25,
        fontWeight: "bold",
        fontStyle: "italic",
        textDecoration: "underline",
        textAlign: "center",
      });
    }
  });
});
