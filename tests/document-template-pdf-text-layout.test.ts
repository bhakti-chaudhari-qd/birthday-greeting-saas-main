import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";

import {
  hexToRgbColor,
  layoutElementLines,
  sanitizeForFont,
  standardFontForTypography,
  wrapParagraph,
} from "@/lib/document-templates/pdf-text-layout";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

let font: PDFFont;
let boldFont: PDFFont;

beforeAll(async () => {
  const pdfDoc = await PDFDocument.create();
  font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
});

describe("layoutElementLines - coordinate conversion", () => {
  it("converts a top-left-origin box to PDF's bottom-left origin", () => {
    const element = { x: 0.5, y: 0.25, width: 0.4, fontSize: 16 };
    const lines = layoutElementLines(element, "Hi", font, PAGE_WIDTH, PAGE_HEIGHT);

    expect(lines).toHaveLength(1);
    expect(lines[0]!.x).toBeCloseTo(0.5 * PAGE_WIDTH);
    // Box top measured from the bottom = pageHeight - y*pageHeight; the
    // baseline of the first line sits one fontSize below that.
    const expectedBoxTopFromBottom = PAGE_HEIGHT - 0.25 * PAGE_HEIGHT;
    expect(lines[0]!.y).toBeCloseTo(expectedBoxTopFromBottom - 16);
  });

  it("places a box near the top of the editor near the top of the PDF page", () => {
    const nearTop = layoutElementLines(
      { x: 0, y: 0.02, width: 0.5, fontSize: 12 },
      "Top",
      font,
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );
    const nearBottom = layoutElementLines(
      { x: 0, y: 0.9, width: 0.5, fontSize: 12 },
      "Bottom",
      font,
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );

    // "Near top" in editor coordinates must land at a HIGH pdf y (close to
    // pageHeight); "near bottom" must land at a LOW pdf y (close to 0).
    // A naive y*pageHeight copy (no flip) would get this backwards.
    expect(nearTop[0]!.y).toBeGreaterThan(nearBottom[0]!.y);
    expect(nearTop[0]!.y).toBeGreaterThan(PAGE_HEIGHT * 0.8);
    expect(nearBottom[0]!.y).toBeLessThan(PAGE_HEIGHT * 0.2);
  });

  it("returns no lines for blank/whitespace-only text", () => {
    const element = { x: 0.1, y: 0.1, width: 0.5, fontSize: 16 };
    expect(layoutElementLines(element, "", font, PAGE_WIDTH, PAGE_HEIGHT)).toEqual([]);
    expect(layoutElementLines(element, "   ", font, PAGE_WIDTH, PAGE_HEIGHT)).toEqual(
      [],
    );
  });
});

describe("layoutElementLines - wrapping and line breaks", () => {
  it("wraps long text to fit the box width, one line per physical line", () => {
    const element = { x: 0, y: 0, width: 0.15, fontSize: 14 }; // narrow box
    const longText =
      "This is a fairly long sentence that should not fit on a single line inside a narrow text box.";

    const lines = layoutElementLines(element, longText, font, PAGE_WIDTH, PAGE_HEIGHT);
    const maxWidth = 0.15 * PAGE_WIDTH;

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line.text, 14)).toBeLessThanOrEqual(maxWidth + 0.5);
    }
    // Reassembling every wrapped line's words must reproduce the original text.
    expect(lines.map((l) => l.text).join(" ")).toBe(longText);
  });

  it("keeps short text on a single line", () => {
    const element = { x: 0, y: 0, width: 0.5, fontSize: 16 };
    const lines = layoutElementLines(element, "Happy Birthday!", font, PAGE_WIDTH, PAGE_HEIGHT);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.text).toBe("Happy Birthday!");
  });

  it("preserves explicit line breaks and steps each line down by the line height", () => {
    const element = { x: 0, y: 0, width: 0.8, fontSize: 20 };
    const lines = layoutElementLines(
      element,
      "Line one\nLine two",
      font,
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]!.text).toBe("Line one");
    expect(lines[1]!.text).toBe("Line two");
    expect(lines[0]!.y - lines[1]!.y).toBeCloseTo(20 * 1.2);
  });

  it("preserves an intentional blank line between paragraphs", () => {
    const element = { x: 0, y: 0, width: 0.8, fontSize: 12 };
    const lines = layoutElementLines(element, "A\n\nB", font, PAGE_WIDTH, PAGE_HEIGHT);
    // "A", blank line (dropped from drawing but still consumes vertical
    // space), "B" - the gap between A and B should be two line heights.
    expect(lines.map((l) => l.text)).toEqual(["A", "B"]);
    expect(lines[0]!.y - lines[1]!.y).toBeCloseTo(12 * 1.2 * 2);
  });
});

describe("layoutElementLines - special characters", () => {
  it("drops characters the standard font cannot encode (e.g. emoji) but keeps the rest", () => {
    const element = { x: 0, y: 0, width: 0.8, fontSize: 16 };
    const lines = layoutElementLines(
      element,
      "Happy Birthday Ishika! 🎉",
      font,
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );

    expect(lines).toHaveLength(1);
    // Only the unencodable emoji is dropped - the space before it stays.
    expect(lines[0]!.text).toBe("Happy Birthday Ishika! ");
    expect(lines[0]!.text).not.toContain("🎉");
  });

  it("keeps accented Latin characters supported by the standard font", () => {
    expect(sanitizeForFont(font, "Café Déjà vu")).toBe("Café Déjà vu");
  });
});

describe("wrapParagraph", () => {
  it("returns a single empty line for empty input", () => {
    expect(wrapParagraph("", font, 12, 200)).toEqual([""]);
  });

  it("never produces a line wider than maxWidth when words individually fit", () => {
    const maxWidth = 100;
    const lines = wrapParagraph(
      "alpha beta gamma delta epsilon",
      font,
      12,
      maxWidth,
    );
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 12)).toBeLessThanOrEqual(maxWidth + 0.5);
    }
  });
});

describe("hexToRgbColor", () => {
  it("converts black and white correctly", () => {
    expect(hexToRgbColor("#000000")).toEqual({ type: "RGB", red: 0, green: 0, blue: 0 });
    expect(hexToRgbColor("#ffffff")).toEqual({ type: "RGB", red: 1, green: 1, blue: 1 });
  });
});

describe("layoutElementLines - alignment", () => {
  it("defaults to left-aligned when textAlign is omitted (backward compatibility)", () => {
    const element = { x: 0.1, y: 0.1, width: 0.5, fontSize: 16 };
    const lines = layoutElementLines(element, "Hi", font, PAGE_WIDTH, PAGE_HEIGHT);
    expect(lines[0]!.x).toBeCloseTo(0.1 * PAGE_WIDTH);
  });

  it("left-aligns explicitly, unchanged from the pre-typography behavior", () => {
    const element = { x: 0.1, y: 0.1, width: 0.5, fontSize: 16, textAlign: "left" as const };
    const lines = layoutElementLines(element, "Hi", font, PAGE_WIDTH, PAGE_HEIGHT);
    expect(lines[0]!.x).toBeCloseTo(0.1 * PAGE_WIDTH);
  });

  it("centers a line within the box width", () => {
    const element = { x: 0.1, y: 0.1, width: 0.5, fontSize: 16, textAlign: "center" as const };
    const lines = layoutElementLines(element, "Hi", font, PAGE_WIDTH, PAGE_HEIGHT);
    const boxLeft = 0.1 * PAGE_WIDTH;
    const boxWidth = 0.5 * PAGE_WIDTH;
    const lineWidth = font.widthOfTextAtSize("Hi", 16);
    expect(lines[0]!.x).toBeCloseTo(boxLeft + (boxWidth - lineWidth) / 2);
  });

  it("right-aligns a line to the box's right edge", () => {
    const element = { x: 0.1, y: 0.1, width: 0.5, fontSize: 16, textAlign: "right" as const };
    const lines = layoutElementLines(element, "Hi", font, PAGE_WIDTH, PAGE_HEIGHT);
    const boxLeft = 0.1 * PAGE_WIDTH;
    const boxWidth = 0.5 * PAGE_WIDTH;
    const lineWidth = font.widthOfTextAtSize("Hi", 16);
    expect(lines[0]!.x).toBeCloseTo(boxLeft + boxWidth - lineWidth);
  });

  it("aligns each wrapped line independently by its own measured width", () => {
    const element = { x: 0, y: 0, width: 0.3, fontSize: 14, textAlign: "right" as const };
    const longText = "A longer sentence that wraps across more than one line here.";
    const lines = layoutElementLines(element, longText, font, PAGE_WIDTH, PAGE_HEIGHT);

    expect(lines.length).toBeGreaterThan(1);
    const boxRight = 0.3 * PAGE_WIDTH;
    for (const line of lines) {
      expect(line.x + line.width).toBeCloseTo(boxRight, 0);
    }
  });

  it("reports the measured width of each line for underline geometry", () => {
    const element = { x: 0, y: 0, width: 0.5, fontSize: 16 };
    const lines = layoutElementLines(element, "Hi", font, PAGE_WIDTH, PAGE_HEIGHT);
    expect(lines[0]!.width).toBeCloseTo(font.widthOfTextAtSize("Hi", 16));
  });

  it("measures and positions using the actual font passed in, not a fixed one", () => {
    const element = { x: 0.1, y: 0.1, width: 0.5, fontSize: 16, textAlign: "right" as const };
    const regularLines = layoutElementLines(element, "Hi", font, PAGE_WIDTH, PAGE_HEIGHT);
    const boldLines = layoutElementLines(element, "Hi", boldFont, PAGE_WIDTH, PAGE_HEIGHT);

    // HelveticaBold is wider than Helvetica for the same text/size, so a
    // right-aligned line's start x must differ between the two fonts.
    expect(boldLines[0]!.width).toBeGreaterThan(regularLines[0]!.width);
    expect(boldLines[0]!.x).toBeLessThan(regularLines[0]!.x);
  });
});

describe("standardFontForTypography", () => {
  it("maps normal + normal to Helvetica", () => {
    expect(standardFontForTypography("normal", "normal")).toBe(
      StandardFonts.Helvetica,
    );
  });

  it("maps bold + normal to HelveticaBold", () => {
    expect(standardFontForTypography("bold", "normal")).toBe(
      StandardFonts.HelveticaBold,
    );
  });

  it("maps normal + italic to HelveticaOblique", () => {
    expect(standardFontForTypography("normal", "italic")).toBe(
      StandardFonts.HelveticaOblique,
    );
  });

  it("maps bold + italic to HelveticaBoldOblique", () => {
    expect(standardFontForTypography("bold", "italic")).toBe(
      StandardFonts.HelveticaBoldOblique,
    );
  });
});
