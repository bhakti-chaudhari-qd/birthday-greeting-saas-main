import { describe, expect, it } from "vitest";

import { computeResizedDimensions } from "@/components/document-templates/overlay-layer";
import {
  MAX_LAYOUT_ELEMENT_HEIGHT,
  MIN_LAYOUT_ELEMENT_HEIGHT,
  MIN_LAYOUT_ELEMENT_WIDTH,
} from "@/lib/validation/document-template-layout";

describe("computeResizedDimensions", () => {
  it("changes width for purely horizontal pointer movement", () => {
    const start = { left: 0.1, top: 0.1 };
    const result = computeResizedDimensions({ x: 0.4, y: 0.1 }, start);
    expect(result.width).toBeCloseTo(0.3);
    // Pointer y is unchanged from the box's own top -> raw delta is 0,
    // which clamps to the height floor (mirrors the next test below).
    expect(result.height).toBe(MIN_LAYOUT_ELEMENT_HEIGHT);
  });

  it("rejects a height of exactly 0 by clamping to the minimum", () => {
    // Pointer at the same y as the box's top -> raw delta is 0, but height
    // can never be 0 (mirrors width's own non-zero floor).
    const start = { left: 0.1, top: 0.1 };
    const result = computeResizedDimensions({ x: 0.1, y: 0.1 }, start);
    expect(result.height).toBe(MIN_LAYOUT_ELEMENT_HEIGHT);
  });

  it("changes height for purely vertical pointer movement", () => {
    const start = { left: 0.1, top: 0.1 };
    const result = computeResizedDimensions({ x: 0.1, y: 0.5 }, start);
    expect(result.width).toBe(MIN_LAYOUT_ELEMENT_WIDTH);
    expect(result.height).toBeCloseTo(0.4);
  });

  it("changes both width and height for diagonal pointer movement", () => {
    const start = { left: 0.1, top: 0.2 };
    const result = computeResizedDimensions({ x: 0.5, y: 0.6 }, start);
    expect(result.width).toBeCloseTo(0.4);
    expect(result.height).toBeCloseTo(0.4);
  });

  it("keeps width within its existing bounds (min width, and can't pass the right page edge)", () => {
    const start = { left: 0.1, top: 0.1 };
    expect(
      computeResizedDimensions({ x: -5, y: 0.1 }, start).width,
    ).toBe(MIN_LAYOUT_ELEMENT_WIDTH);
    expect(
      computeResizedDimensions({ x: 5, y: 0.1 }, start).width,
    ).toBeCloseTo(1 - start.left);
  });

  it("respects the height minimum", () => {
    const start = { left: 0.1, top: 0.1 };
    const result = computeResizedDimensions({ x: 0.1, y: -5 }, start);
    expect(result.height).toBe(MIN_LAYOUT_ELEMENT_HEIGHT);
  });

  it("never lets height push the box past the bottom page boundary (maxHeight = 1 - top)", () => {
    const start = { left: 0.1, top: 0.7 };
    const result = computeResizedDimensions({ x: 0.1, y: 5 }, start);
    expect(result.height).toBeCloseTo(1 - start.top);
    expect(start.top + result.height).toBeLessThanOrEqual(
      MAX_LAYOUT_ELEMENT_HEIGHT + 1e-9,
    );
  });

  it("computes height purely from the start reference, independent of width/x", () => {
    const start = { left: 0.1, top: 0.3 };
    const nearLeft = computeResizedDimensions({ x: 0.15, y: 0.5 }, start);
    const nearRight = computeResizedDimensions({ x: 0.9, y: 0.5 }, start);
    expect(nearLeft.height).toBeCloseTo(nearRight.height);
  });

  it("only ever produces width and height - never x, y, text, or typography keys", () => {
    // computeResizedDimensions is the only thing feeding the resize
    // handler's onElementChange(id, { width, height }) patch - its return
    // shape is the guarantee that resizing can't touch position, content,
    // or typography.
    const result = computeResizedDimensions(
      { x: 0.4, y: 0.6 },
      { left: 0.1, top: 0.1 },
    );
    expect(Object.keys(result).sort()).toEqual(["height", "width"]);
  });

  it("does not throw for extreme or unusual pointer/start values", () => {
    expect(() =>
      computeResizedDimensions({ x: NaN, y: NaN }, { left: 0, top: 0 }),
    ).not.toThrow();
    expect(() =>
      computeResizedDimensions({ x: -1000, y: 1000 }, { left: 1, top: 1 }),
    ).not.toThrow();
    expect(() =>
      computeResizedDimensions({ x: 0, y: 0 }, { left: 0, top: 0 }),
    ).not.toThrow();
  });
});
