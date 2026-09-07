import { StandardFonts, rgb, type PDFFont } from "pdf-lib";

import {
  DEFAULT_TEXT_ALIGN,
  type FontStyle,
  type FontWeight,
  type LayoutTextElement,
  type TextAlign,
} from "@/lib/validation/document-template-layout";

/** Editor uses "leading-tight" (~1.2x) for line height - keep generation in step. */
export const LINE_HEIGHT_MULTIPLIER = 1.2;

/**
 * Typography V1 supports only pdf-lib's built-in Helvetica variants (no
 * embedded font files). Pure mapping so the exact same logic drives both
 * which fonts generate.service.ts embeds and which one a given element uses.
 */
export function standardFontForTypography(
  fontWeight: FontWeight,
  fontStyle: FontStyle,
): StandardFonts {
  if (fontWeight === "bold" && fontStyle === "italic") {
    return StandardFonts.HelveticaBoldOblique;
  }
  if (fontWeight === "bold") {
    return StandardFonts.HelveticaBold;
  }
  if (fontStyle === "italic") {
    return StandardFonts.HelveticaOblique;
  }
  return StandardFonts.Helvetica;
}

export function hexToRgbColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

/** Drops characters the standard font can't encode (emoji, non-Latin scripts, ...) instead of failing generation. */
export function sanitizeForFont(font: PDFFont, text: string): string {
  let result = "";
  for (const char of text) {
    try {
      font.widthOfTextAtSize(char, 10);
      result += char;
    } catch {
      // unencodable in this font - drop it.
    }
  }
  return result;
}

/** Greedy word-wrap of a single paragraph (no newlines) to fit maxWidth. */
export function wrapParagraph(
  paragraph: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = paragraph.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  lines.push(currentLine);
  return lines;
}

export type LayoutLine = {
  text: string;
  /** PDF points, bottom-left origin. */
  x: number;
  /** Baseline, not line top. */
  y: number;
  /** Measured width of `text` at the element's font/size - reused for underline geometry. */
  width: number;
};

/** x for a wrapped line's left edge, given its measured width and the box's alignment. */
function alignedLineX(
  boxLeft: number,
  boxWidth: number,
  lineWidth: number,
  textAlign: TextAlign,
): number {
  if (textAlign === "center") {
    return boxLeft + (boxWidth - lineWidth) / 2;
  }
  if (textAlign === "right") {
    return boxLeft + boxWidth - lineWidth;
  }
  return boxLeft;
}

/**
 * Converts an editor text box (normalized 0-1, top-left origin) plus its
 * already variable-replaced text into concrete PDF line positions - pure
 * math, no drawing, so coordinate conversion and wrapping can be unit
 * tested without rendering an actual PDF.
 *
 * Coordinate conversion: the editor works like a browser (origin top-left,
 * y grows downward); PDF points use a bottom-left origin (y grows upward).
 * So a box's top edge, measured from the bottom of the page, is
 * `pageHeight - element.y * pageHeight`. A line's `y` is its text
 * *baseline*, not its top, so the first line is offset down by one
 * fontSize before subsequent lines step down by the line height.
 *
 * `font` must be the same variant (weight/style) the caller will draw with -
 * measuring against a different variant would produce wrapping/alignment
 * that doesn't match what actually gets drawn, since glyph widths differ
 * between Helvetica/HelveticaBold/HelveticaOblique/HelveticaBoldOblique.
 */
export function layoutElementLines(
  element: Pick<LayoutTextElement, "x" | "y" | "width" | "fontSize" | "textAlign">,
  renderedText: string,
  font: PDFFont,
  pageWidth: number,
  pageHeight: number,
): LayoutLine[] {
  if (!renderedText.trim()) {
    return [];
  }

  const boxLeft = element.x * pageWidth;
  const boxTopFromBottom = pageHeight - element.y * pageHeight;
  const boxWidth = element.width * pageWidth;
  const fontSize = element.fontSize;
  const lineHeight = fontSize * LINE_HEIGHT_MULTIPLIER;
  const textAlign = element.textAlign ?? DEFAULT_TEXT_ALIGN;

  const wrappedLines = renderedText
    .split("\n")
    .map((paragraph) => sanitizeForFont(font, paragraph))
    .flatMap((paragraph) => wrapParagraph(paragraph, font, fontSize, boxWidth));

  const result: LayoutLine[] = [];
  let baselineY = boxTopFromBottom - fontSize;
  for (const line of wrappedLines) {
    if (line.length > 0) {
      const lineWidth = font.widthOfTextAtSize(line, fontSize);
      const x = alignedLineX(boxLeft, boxWidth, lineWidth, textAlign);
      result.push({ text: line, x, y: baselineY, width: lineWidth });
    }
    baselineY -= lineHeight;
  }
  return result;
}
