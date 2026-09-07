import { describe, expect, it } from "vitest";

import { resolveAutomationCreatesPerRun } from "@/lib/automation/caps";
import { prepareContactImportRow } from "@/lib/contacts/import-batch";

describe("automation caps", () => {
  it("scales creates per run with contact limit", () => {
    expect(resolveAutomationCreatesPerRun(500)).toBeGreaterThanOrEqual(50);
    expect(resolveAutomationCreatesPerRun(300_000)).toBe(10_000);
  });
});

describe("import batch helpers", () => {
  it("rejects invalid rows without throwing", () => {
    const result = prepareContactImportRow(2, {
      name: "",
      mobile: "+919876543210",
      email: null,
      occasions: {},
      categoryName: null,
      address: null,
      note: null,
      isActive: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rowNumber).toBe(2);
    }
  });
});
