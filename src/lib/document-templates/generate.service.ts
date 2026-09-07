import { PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";

import {
  documentTemplateLayoutSchema,
  resolveTypography,
  type DocumentTemplateLayout,
  type FontStyle,
  type FontWeight,
  type LayoutTextElement,
} from "@/lib/validation/document-template-layout";

import { DocumentTemplateValidationError } from "./errors";
import { getLayout } from "./layout.service";
import {
  hexToRgbColor,
  layoutElementLines,
  standardFontForTypography,
} from "./pdf-text-layout";
import { getDocumentTemplateFile } from "./service";
import { extractVariableNames, replaceVariables } from "./variables";

/** Underline offset/thickness scale with font size, matching typical text-underline proportions. */
const UNDERLINE_OFFSET_RATIO = 0.08;
const UNDERLINE_THICKNESS_RATIO = 0.05;
const MIN_UNDERLINE_THICKNESS = 0.5;

/** One embedded PDFFont per (fontWeight, fontStyle) combination, embedded once per document. */
type FontVariantMap = Record<FontWeight, Record<FontStyle, PDFFont>>;

async function embedFontVariants(pdfDoc: PDFDocument): Promise<FontVariantMap> {
  const [normalNormal, normalItalic, boldNormal, boldItalic] = await Promise.all([
    pdfDoc.embedFont(standardFontForTypography("normal", "normal")),
    pdfDoc.embedFont(standardFontForTypography("normal", "italic")),
    pdfDoc.embedFont(standardFontForTypography("bold", "normal")),
    pdfDoc.embedFont(standardFontForTypography("bold", "italic")),
  ]);

  return {
    normal: { normal: normalNormal, italic: normalItalic },
    bold: { normal: boldNormal, italic: boldItalic },
  };
}

function parseStoredLayout(layoutJson: unknown): DocumentTemplateLayout {
  const result = documentTemplateLayoutSchema.safeParse(layoutJson);
  if (!result.success) {
    throw new DocumentTemplateValidationError(
      "Saved layout is invalid and cannot be rendered",
    );
  }
  return result.data;
}

function assertAllVariablesProvided(
  layout: DocumentTemplateLayout,
  data: Record<string, string>,
): void {
  const required = new Set<string>();
  for (const element of layout.elements) {
    for (const name of extractVariableNames(element.text)) {
      required.add(name);
    }
  }

  const missing = [...required].filter((name) => !(name in data));
  if (missing.length > 0) {
    throw new DocumentTemplateValidationError(
      `Missing value${missing.length > 1 ? "s" : ""} for: ${missing.join(", ")}`,
    );
  }
}

function drawTextElement(
  page: PDFPage,
  fonts: FontVariantMap,
  element: LayoutTextElement,
  data: Record<string, string>,
  pageWidth: number,
  pageHeight: number,
): void {
  const rendered = replaceVariables(element.text, data);
  const typography = resolveTypography(element);
  const font = fonts[typography.fontWeight][typography.fontStyle];
  const color = hexToRgbColor(element.color);

  for (const line of layoutElementLines(element, rendered, font, pageWidth, pageHeight)) {
    page.drawText(line.text, {
      x: line.x,
      y: line.y,
      size: element.fontSize,
      font,
      color,
    });

    if (typography.textDecoration === "underline") {
      const underlineY = line.y - element.fontSize * UNDERLINE_OFFSET_RATIO;
      page.drawLine({
        start: { x: line.x, y: underlineY },
        end: { x: line.x + line.width, y: underlineY },
        thickness: Math.max(
          MIN_UNDERLINE_THICKNESS,
          element.fontSize * UNDERLINE_THICKNESS_RATIO,
        ),
        color,
      });
    }
  }
}

async function renderPdf(
  baseBytes: Uint8Array,
  layout: DocumentTemplateLayout,
  data: Record<string, string>,
): Promise<Uint8Array> {
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(baseBytes);
  } catch {
    throw new DocumentTemplateValidationError("Template PDF could not be opened");
  }

  // Single-page only, matching the editor (Phase 2 rule).
  const [page] = pdfDoc.getPages();
  if (!page) {
    throw new DocumentTemplateValidationError("Template PDF has no pages");
  }

  const fonts = await embedFontVariants(pdfDoc);
  const { width: pageWidth, height: pageHeight } = page.getSize();

  for (const element of layout.elements) {
    drawTextElement(page, fonts, element, data, pageWidth, pageHeight);
  }

  return pdfDoc.save();
}

function buildGeneratedFileName(templateFileName: string): string {
  const base = templateFileName.replace(/\.pdf$/i, "").trim() || "document";
  return `${base}-generated-${Date.now()}.pdf`;
}

export type GeneratedDocument = {
  bytes: Uint8Array;
  fileName: string;
};

/**
 * Template + saved layout + variable data -> one personalized PDF.
 * Independent of HTTP and of where `data` comes from (manual input today;
 * CSV rows, contact records, etc. later) so it can be reused by a queue,
 * bulk generation, or delivery without rewriting this logic.
 */
export async function generateDocumentPdf(
  organizationId: string,
  templateId: string,
  data: Record<string, string>,
): Promise<GeneratedDocument> {
  const [file, layoutJson] = await Promise.all([
    getDocumentTemplateFile(organizationId, templateId),
    getLayout(organizationId, templateId),
  ]);

  if (!layoutJson) {
    throw new DocumentTemplateValidationError(
      "This template has no saved layout yet. Add text in the editor and save before generating.",
    );
  }

  const layout = parseStoredLayout(layoutJson);
  assertAllVariablesProvided(layout, data);

  const bytes = await renderPdf(file.bytes, layout, data);

  return {
    bytes,
    fileName: buildGeneratedFileName(file.fileName),
  };
}
