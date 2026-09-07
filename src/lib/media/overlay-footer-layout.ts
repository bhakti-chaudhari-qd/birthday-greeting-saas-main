/**
 * Shared footer overlay layout (no Node/canvas deps - safe for client + server).
 *
 * Canvas = base photo size.
 * Footer scaled to base width (aspect preserved) and drawn at the bottom.
 * Callers should trim empty padding from the footer first.
 */
export function overlayFooterLayout(
  baseWidth: number,
  baseHeight: number,
  footerWidth: number,
  footerHeight: number,
  maxEdge = 1920,
) {
  let width = baseWidth;
  let height = baseHeight;
  const longest = Math.max(width, height);
  if (longest > maxEdge) {
    const scale = maxEdge / longest;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  let scale = width / footerWidth;
  let footerDrawW = width;
  let footerDrawH = Math.max(1, Math.round(footerHeight * scale));
  let footerX = 0;

  // If the footer would be taller than the photo, shrink uniformly so nothing is clipped.
  if (footerDrawH > height) {
    scale = height / footerHeight;
    footerDrawH = height;
    footerDrawW = Math.max(1, Math.round(footerWidth * scale));
    footerX = Math.round((width - footerDrawW) / 2);
  }

  return {
    width,
    height,
    footerDrawW,
    footerDrawH,
    footerX,
    footerY: height - footerDrawH,
  };
}

const TRIM_ALPHA = 10;
const TRIM_BLACK = 16;
const TRIM_WHITE = 248;

/**
 * True when a pixel is empty padding (transparent, near-black, or near-white).
 * Footer templates are often full-canvas with clear/black/white space above the artwork.
 */
export function isFooterPaddingPixel(
  r: number,
  g: number,
  b: number,
  a: number,
) {
  if (a <= TRIM_ALPHA) return true;
  if (r <= TRIM_BLACK && g <= TRIM_BLACK && b <= TRIM_BLACK) return true;
  if (r >= TRIM_WHITE && g >= TRIM_WHITE && b >= TRIM_WHITE) return true;
  return false;
}

/**
 * Bounding box of non-padding pixels. Returns null if the image is entirely empty.
 */
export function findFooterContentBounds(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } | null {
  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  const rowHasContent = (y: number) => {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const i = row + x * 4;
      if (
        !isFooterPaddingPixel(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!)
      ) {
        return true;
      }
    }
    return false;
  };

  const colHasContent = (x: number, y0: number, y1: number) => {
    for (let y = y0; y <= y1; y += 1) {
      const i = (y * width + x) * 4;
      if (
        !isFooterPaddingPixel(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!)
      ) {
        return true;
      }
    }
    return false;
  };

  while (top < height && !rowHasContent(top)) top += 1;
  while (bottom >= top && !rowHasContent(bottom)) bottom -= 1;
  if (top > bottom) return null;

  while (left < width && !colHasContent(left, top, bottom)) left += 1;
  while (right >= left && !colHasContent(right, top, bottom)) right -= 1;

  return {
    left,
    top,
    width: Math.max(1, right - left + 1),
    height: Math.max(1, bottom - top + 1),
  };
}
