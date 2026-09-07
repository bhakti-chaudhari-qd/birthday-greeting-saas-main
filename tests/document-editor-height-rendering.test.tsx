import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TextBox } from "@/components/document-templates/text-box";
import type { LayoutTextElement } from "@/lib/validation/document-template-layout";

function element(overrides: Partial<LayoutTextElement> = {}): LayoutTextElement {
  return {
    id: "el-1",
    type: "text",
    x: 0.1,
    y: 0.2,
    width: 0.5,
    text: "Happy Birthday {{name}}!",
    fontSize: 16,
    color: "#000000",
    ...overrides,
  };
}

const noop = () => {};

function renderTextBox(el: LayoutTextElement) {
  return renderToStaticMarkup(
    <TextBox
      element={el}
      onDragHandlePointerDown={noop}
      onResizeHandlePointerDown={noop}
      onTextChange={noop}
      onDelete={noop}
      onFocus={noop}
      onRegisterTextarea={noop}
    />,
  );
}

describe("TextBox height rendering", () => {
  it("applies no inline height/flex styling when height is undefined (auto-height, unchanged)", () => {
    const html = renderTextBox(element());

    expect(html).not.toContain("height:");
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("flex:1");
  });

  it("applies a fixed percentage height and flex layout when height is set", () => {
    const html = renderTextBox(element({ height: 0.25 }));

    expect(html).toContain("height:25%");
    expect(html).toContain("display:flex");
    expect(html).toContain("flex-direction:column");
  });

  it("stretches the highlight layer to 100% only when height is fixed", () => {
    const auto = renderTextBox(element());
    const fixed = renderTextBox(element({ height: 0.25 }));

    expect(auto).not.toContain("height:100%");
    expect(fixed).toContain("height:100%");
  });

  it("keeps variable highlighting intact regardless of whether height is fixed", () => {
    const auto = renderTextBox(element());
    const fixed = renderTextBox(element({ height: 0.4 }));

    for (const html of [auto, fixed]) {
      expect(html).toContain("<mark");
      expect(html).toContain("{{name}}");
      expect(html).toContain("Happy Birthday");
    }
  });

  it("still renders width positioning identically regardless of height", () => {
    const auto = renderTextBox(element({ x: 0.3, width: 0.4 }));
    const fixed = renderTextBox(element({ x: 0.3, width: 0.4, height: 0.2 }));

    expect(auto).toContain("left:30%");
    expect(auto).toContain("width:40%");
    expect(fixed).toContain("left:30%");
    expect(fixed).toContain("width:40%");
  });
});
