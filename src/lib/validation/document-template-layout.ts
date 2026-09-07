import { z } from "zod";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

/** Caps the stored JSON blob size - a design surface, not a bulk data store. */
export const MAX_LAYOUT_ELEMENTS = 200;

/** Floor so a resized box always stays grabbable; mirrors the editor's resize clamp. */
export const MIN_LAYOUT_ELEMENT_WIDTH = 0.02;

/**
 * Height V1 bounds, mirroring the width constraint above. Height stays
 * optional - undefined means "auto height from content" (the only behavior
 * that existed before this feature), matching every pre-height stored
 * element and every element until the user manually resizes it vertically.
 */
export const MIN_LAYOUT_ELEMENT_HEIGHT = 0.02;
export const MAX_LAYOUT_ELEMENT_HEIGHT = 1;

/** Typography V1 font-size bounds - shared by validation and the editor's UI control. */
export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 120;

const fontWeightSchema = z.enum(["normal", "bold"]);
const fontStyleSchema = z.enum(["normal", "italic"]);
const textDecorationSchema = z.enum(["none", "underline"]);
const textAlignSchema = z.enum(["left", "center", "right"]);

export type FontWeight = z.infer<typeof fontWeightSchema>;
export type FontStyle = z.infer<typeof fontStyleSchema>;
export type TextDecoration = z.infer<typeof textDecorationSchema>;
export type TextAlign = z.infer<typeof textAlignSchema>;

/**
 * Typography V1 defaults. Existing stored elements (and any partial patch
 * that omits these) resolve to these values, so pre-typography templates
 * render exactly as before - see resolveTypography().
 */
export const DEFAULT_FONT_WEIGHT: FontWeight = "normal";
export const DEFAULT_FONT_STYLE: FontStyle = "normal";
export const DEFAULT_TEXT_DECORATION: TextDecoration = "none";
export const DEFAULT_TEXT_ALIGN: TextAlign = "left";

const layoutTextElementSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    type: z.literal("text"),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(MIN_LAYOUT_ELEMENT_WIDTH).max(1),
    height: z
      .number()
      .min(MIN_LAYOUT_ELEMENT_HEIGHT)
      .max(MAX_LAYOUT_ELEMENT_HEIGHT)
      .optional(),
    text: z.string().max(500),
    fontSize: z.number().min(MIN_FONT_SIZE).max(MAX_FONT_SIZE),
    color: z
      .string()
      .regex(HEX_COLOR_PATTERN, "color must be a hex value like #000000"),
    fontWeight: fontWeightSchema.optional(),
    fontStyle: fontStyleSchema.optional(),
    textDecoration: textDecorationSchema.optional(),
    textAlign: textAlignSchema.optional(),
  })
  .strict();

export const documentTemplateLayoutSchema = z
  .object({
    elements: z.array(layoutTextElementSchema).max(MAX_LAYOUT_ELEMENTS),
  })
  .strict();

export const saveDocumentTemplateLayoutSchema = z
  .object({
    layoutJson: documentTemplateLayoutSchema,
  })
  .strict();

export type LayoutTextElement = z.infer<typeof layoutTextElementSchema>;
export type DocumentTemplateLayout = z.infer<
  typeof documentTemplateLayoutSchema
>;

/**
 * Resolves the four Typography V1 properties to their effective values,
 * defaulting anything missing (older stored elements, or a fresh patch that
 * only touches other fields). The single place both the editor's CSS
 * mapping and the PDF's pdf-lib mapping read from.
 */
export function resolveTypography(
  element: Pick<
    LayoutTextElement,
    "fontWeight" | "fontStyle" | "textDecoration" | "textAlign"
  >,
): {
  fontWeight: FontWeight;
  fontStyle: FontStyle;
  textDecoration: TextDecoration;
  textAlign: TextAlign;
} {
  return {
    fontWeight: element.fontWeight ?? DEFAULT_FONT_WEIGHT,
    fontStyle: element.fontStyle ?? DEFAULT_FONT_STYLE,
    textDecoration: element.textDecoration ?? DEFAULT_TEXT_DECORATION,
    textAlign: element.textAlign ?? DEFAULT_TEXT_ALIGN,
  };
}
