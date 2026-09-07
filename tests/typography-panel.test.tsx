import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TypographyPanel } from "@/components/document-templates/typography-panel";
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

describe("TypographyPanel", () => {
  it("disables every control when no text element is selected", () => {
    const html = renderToStaticMarkup(
      <TypographyPanel element={null} onChange={() => {}} />,
    );

    expect(html).toContain("Select a text box to format it");
    // Every interactive control should carry the disabled attribute.
    const disabledCount = (html.match(/disabled=""/g) ?? []).length;
    expect(disabledCount).toBeGreaterThan(0);
    // Left-align is the inert default shown while disabled; nothing else
    // (bold/italic/underline/center/right) should read as pressed.
    expect(html).toContain('aria-label="Align left" aria-pressed="true"');
    const pressedCount = (html.match(/aria-pressed="true"/g) ?? []).length;
    expect(pressedCount).toBe(1);
  });

  it("reflects the selected element's current typography as pressed/active", () => {
    const html = renderToStaticMarkup(
      <TypographyPanel
        element={element({
          fontWeight: "bold",
          fontStyle: "italic",
          textDecoration: "underline",
          textAlign: "center",
          fontSize: 22,
          color: "#ff0000",
        })}
        onChange={() => {}}
      />,
    );

    expect(html).not.toContain('disabled=""');
    expect(html).toContain('value="22"');
    expect(html).toContain('value="#ff0000"');

    // Bold, Italic, Underline, and Center should each render as pressed.
    const pressedCount = (html.match(/aria-pressed="true"/g) ?? []).length;
    expect(pressedCount).toBe(4);
  });

  it("defaults to left-aligned, non-bold, non-italic, no-underline for an element with no typography fields", () => {
    const html = renderToStaticMarkup(
      <TypographyPanel element={element()} onChange={() => {}} />,
    );

    // Only "Left" alignment should be pressed; nothing else.
    const pressedCount = (html.match(/aria-pressed="true"/g) ?? []).length;
    expect(pressedCount).toBe(1);
    expect(html).toContain('aria-label="Align left" aria-pressed="true"');
  });
});
