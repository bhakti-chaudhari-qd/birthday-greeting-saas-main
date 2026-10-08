import { describe, expect, it } from "vitest";

import { paginate } from "@/components/admin/list-pagination";

const items = Array.from({ length: 45 }, (_, index) => index + 1);

describe("paginate", () => {
  it("returns the requested page and the page count", () => {
    expect(paginate(items, 1)).toMatchObject({ totalPages: 3, currentPage: 1 });
    expect(paginate(items, 1).pageItems).toHaveLength(20);
    expect(paginate(items, 3).pageItems).toEqual([41, 42, 43, 44, 45]);
  });

  it("clamps a page that is out of range, e.g. after a search narrows the list", () => {
    expect(paginate(items, 9).currentPage).toBe(3);
    expect(paginate(items, 0).currentPage).toBe(1);
  });

  it("reports one empty page for an empty list", () => {
    expect(paginate([], 1)).toEqual({ pageItems: [], totalPages: 1, currentPage: 1 });
  });
});
