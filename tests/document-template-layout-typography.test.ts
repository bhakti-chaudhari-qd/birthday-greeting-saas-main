import { describe, expect, it } from "vitest";

import {
  DEFAULT_FONT_STYLE,
  DEFAULT_FONT_WEIGHT,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_TEXT_DECORATION,
  documentTemplateLayoutSchema,
  resolveTypography,
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

describe("document template layout typography validation", () => {
  it("accepts a layout without any typography fields (pre-existing templates)", () => {
    const result = parseElements([baseElement()]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.elements[0]!.fontWeight).toBeUndefined();
      expect(result.data.elements[0]!.fontStyle).toBeUndefined();
      expect(result.data.elements[0]!.textDecoration).toBeUndefined();
      expect(result.data.elements[0]!.textAlign).toBeUndefined();
    }
  });

  it.each(["normal", "bold"])("accepts a valid fontWeight (%s)", (fontWeight) => {
    expect(parseElements([baseElement({ fontWeight })]).success).toBe(true);
  });

  it.each(["light", "700", "", "BOLD"])(
    "rejects an invalid fontWeight (%s)",
    (fontWeight) => {
      expect(parseElements([baseElement({ fontWeight })]).success).toBe(false);
    },
  );

  it.each(["normal", "italic"])("accepts a valid fontStyle (%s)", (fontStyle) => {
    expect(parseElements([baseElement({ fontStyle })]).success).toBe(true);
  });

  it.each(["oblique", "slanted", ""])(
    "rejects an invalid fontStyle (%s)",
    (fontStyle) => {
      expect(parseElements([baseElement({ fontStyle })]).success).toBe(false);
    },
  );

  it.each(["none", "underline"])(
    "accepts a valid textDecoration (%s)",
    (textDecoration) => {
      expect(parseElements([baseElement({ textDecoration })]).success).toBe(true);
    },
  );

  it.each(["strikethrough", "overline", ""])(
    "rejects an invalid textDecoration (%s)",
    (textDecoration) => {
      expect(parseElements([baseElement({ textDecoration })]).success).toBe(false);
    },
  );

  it.each(["left", "center", "right"])(
    "accepts a valid textAlign (%s)",
    (textAlign) => {
      expect(parseElements([baseElement({ textAlign })]).success).toBe(true);
    },
  );

  it.each(["justify", "middle", ""])(
    "rejects an invalid textAlign (%s)",
    (textAlign) => {
      expect(parseElements([baseElement({ textAlign })]).success).toBe(false);
    },
  );

  it("accepts all four typography properties together", () => {
    const result = parseElements([
      baseElement({
        fontWeight: "bold",
        fontStyle: "italic",
        textDecoration: "underline",
        textAlign: "center",
      }),
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.elements[0]).toMatchObject({
        fontWeight: "bold",
        fontStyle: "italic",
        textDecoration: "underline",
        textAlign: "center",
      });
    }
  });

  it("still rejects unrelated invalid fields alongside valid typography", () => {
    const result = parseElements([
      baseElement({ fontWeight: "bold", x: 1.5 }),
    ]);
    expect(result.success).toBe(false);
  });

  it("still rejects unknown extra keys (strict object)", () => {
    const result = parseElements([baseElement({ letterSpacing: 2 })]);
    expect(result.success).toBe(false);
  });
});

describe("resolveTypography", () => {
  it("defaults every property when none are stored (existing pre-typography elements)", () => {
    expect(resolveTypography({})).toEqual({
      fontWeight: DEFAULT_FONT_WEIGHT,
      fontStyle: DEFAULT_FONT_STYLE,
      textDecoration: DEFAULT_TEXT_DECORATION,
      textAlign: DEFAULT_TEXT_ALIGN,
    });
  });

  it("preserves explicitly stored values", () => {
    expect(
      resolveTypography({
        fontWeight: "bold",
        fontStyle: "italic",
        textDecoration: "underline",
        textAlign: "right",
      }),
    ).toEqual({
      fontWeight: "bold",
      fontStyle: "italic",
      textDecoration: "underline",
      textAlign: "right",
    });
  });

  it("defaults only the properties that are missing", () => {
    expect(resolveTypography({ fontWeight: "bold" })).toEqual({
      fontWeight: "bold",
      fontStyle: DEFAULT_FONT_STYLE,
      textDecoration: DEFAULT_TEXT_DECORATION,
      textAlign: DEFAULT_TEXT_ALIGN,
    });
  });
});
