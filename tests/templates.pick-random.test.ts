import { describe, expect, it } from "vitest";

import { pickRandomTemplateId } from "@/lib/templates/pick-random";

describe("pickRandomTemplateId", () => {
  it("returns null when there are no templates", () => {
    expect(pickRandomTemplateId([])).toBeNull();
  });

  it("returns the only template when the list has one item", () => {
    expect(
      pickRandomTemplateId([{ id: "only" }], { random: () => 0.99 }),
    ).toBe("only");
  });

  it("uses the injected random source to pick an index", () => {
    const templates = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(pickRandomTemplateId(templates, { random: () => 0 })).toBe("a");
    expect(pickRandomTemplateId(templates, { random: () => 0.5 })).toBe("b");
    expect(pickRandomTemplateId(templates, { random: () => 0.99 })).toBe("c");
  });

  it("avoids the currently selected template when others exist", () => {
    const templates = [{ id: "a" }, { id: "b" }];
    expect(
      pickRandomTemplateId(templates, {
        excludeId: "a",
        random: () => 0,
      }),
    ).toBe("b");
  });
});
