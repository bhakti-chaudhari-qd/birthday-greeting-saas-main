import { describe, expect, it } from "vitest";

import { templateMatchesAutomationCategory } from "@/lib/templates/serialize";

describe("templateMatchesAutomationCategory", () => {
  it("shows only All-group templates on the All automation row", () => {
    expect(templateMatchesAutomationCategory(null, null)).toBe(true);
    expect(templateMatchesAutomationCategory("vip", null)).toBe(false);
  });

  it("shows All-group and matching-group templates on a group row", () => {
    expect(templateMatchesAutomationCategory(null, "vip")).toBe(true);
    expect(templateMatchesAutomationCategory("vip", "vip")).toBe(true);
    expect(templateMatchesAutomationCategory("friend", "vip")).toBe(false);
  });
});
