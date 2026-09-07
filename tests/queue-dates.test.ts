import { describe, expect, it } from "vitest";

import {
  formatIsoDate,
  getPreviousIsoDate,
  parseTargetDate,
} from "@/lib/queue/dates";

describe("getPreviousIsoDate", () => {
  it("steps back one calendar day", () => {
    expect(getPreviousIsoDate("2026-07-23")).toBe("2026-07-22");
  });

  it("crosses month and year boundaries", () => {
    expect(getPreviousIsoDate("2026-03-01")).toBe("2026-02-28");
    expect(getPreviousIsoDate("2026-01-01")).toBe("2025-12-31");
  });

  it("handles leap day", () => {
    expect(getPreviousIsoDate("2024-03-01")).toBe("2024-02-29");
  });

  it("round-trips with parseTargetDate", () => {
    const previous = getPreviousIsoDate("2026-07-23");
    expect(parseTargetDate(previous).isoDate).toBe(previous);
    expect(formatIsoDate(2026, 7, 22)).toBe(previous);
  });
});
