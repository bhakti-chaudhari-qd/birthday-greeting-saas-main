import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findFooterContentBounds,
  overlayFooterLayout,
} from "@/lib/media/overlay-footer-layout";

describe("overlayFooterLayout", () => {
  it("matches footer width to the base and pins it to the bottom", () => {
    const layout = overlayFooterLayout(1080, 1350, 1080, 400);

    assert.equal(layout.width, 1080);
    assert.equal(layout.height, 1350);
    assert.equal(layout.footerDrawW, 1080);
    assert.equal(layout.footerDrawH, 400);
    assert.equal(layout.footerX, 0);
    assert.equal(layout.footerY, 1350 - 400);
  });

  it("scales the footer when the base size changes", () => {
    const layout = overlayFooterLayout(540, 675, 1080, 400);

    assert.equal(layout.width, 540);
    assert.equal(layout.height, 675);
    assert.equal(layout.footerDrawW, 540);
    assert.equal(layout.footerDrawH, 200);
    assert.equal(layout.footerY, 675 - 200);
  });

  it("shrinks a very tall footer so it stays inside the base", () => {
    const layout = overlayFooterLayout(800, 600, 400, 800);

    assert.equal(layout.width, 800);
    assert.equal(layout.height, 600);
    assert.equal(layout.footerDrawH, 600);
    assert.ok(layout.footerDrawW <= 800);
    assert.equal(layout.footerY, 0);
  });
});

describe("findFooterContentBounds", () => {
  it("trims transparent rows above the artwork", () => {
    const width = 4;
    const height = 6;
    const data = new Uint8ClampedArray(width * height * 4);

    // Top 3 rows fully transparent.
    // Bottom 3 rows solid green.
    for (let y = 3; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        data[i] = 0;
        data[i + 1] = 128;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }

    const bounds = findFooterContentBounds(data, width, height);
    assert.ok(bounds);
    assert.equal(bounds!.top, 3);
    assert.equal(bounds!.height, 3);
    assert.equal(bounds!.left, 0);
    assert.equal(bounds!.width, 4);
  });

  it("trims near-white padding above the artwork", () => {
    const width = 3;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        if (y < 1) {
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
          data[i + 3] = 255;
        } else {
          data[i] = 10;
          data[i + 1] = 100;
          data[i + 2] = 50;
          data[i + 3] = 255;
        }
      }
    }

    const bounds = findFooterContentBounds(data, width, height);
    assert.ok(bounds);
    assert.equal(bounds!.top, 1);
    assert.equal(bounds!.height, 3);
  });

  it("trims near-black padding above the artwork", () => {
    const width = 3;
    const height = 5;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        if (y < 2) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 255;
        } else {
          data[i] = 20;
          data[i + 1] = 90;
          data[i + 2] = 40;
          data[i + 3] = 255;
        }
      }
    }

    const bounds = findFooterContentBounds(data, width, height);
    assert.ok(bounds);
    assert.equal(bounds!.top, 2);
    assert.equal(bounds!.height, 3);
  });
});
