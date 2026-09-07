import { describe, expect, it } from "vitest";

import {
  buildContactCsvTemplate,
  parseContactCsv,
} from "@/lib/contacts/csv";

const occasionOptions = {
  occasionKeyByHeader: { anniversary: "anniversary" },
};

describe("contact CSV occasion dates", () => {
  it("accepts day-month-year occasion dates with hyphens or slashes", () => {
    const hyphenated = parseContactCsv(
      "name,mobile,Anniversary\nTest,9876543210,05-12-2024\n",
      occasionOptions,
    );
    const slashed = parseContactCsv(
      "name,mobile,Anniversary\nTest,9876543210,12/05/2002\n",
      occasionOptions,
    );
    const singleDigit = parseContactCsv(
      "name,mobile,Anniversary\nTest,9876543210,6/1/1987\n",
      occasionOptions,
    );

    expect(hyphenated.errors).toHaveLength(0);
    expect(hyphenated.rows[0]?.input.occasions).toEqual({
      anniversary: "05-12-2024",
    });
    expect(slashed.errors).toHaveLength(0);
    expect(slashed.rows[0]?.input.occasions).toEqual({
      anniversary: "12/05/2002",
    });
    expect(singleDigit.errors).toHaveLength(0);
    expect(singleDigit.rows[0]?.input.occasions).toEqual({
      anniversary: "6/1/1987",
    });
  });

  it("accepts dot-separated, ISO, and month-name occasion date formats", () => {
    const dotted = parseContactCsv(
      "name,mobile,Anniversary\nTest,9876543210,14.08.2026\n",
      occasionOptions,
    );
    const iso = parseContactCsv(
      "name,mobile,Anniversary\nTest,9876543210,2024-12-05\n",
      occasionOptions,
    );
    const dayMonthName = parseContactCsv(
      "name,mobile,Anniversary\nTest,9876543210,14 Aug 2026\n",
      occasionOptions,
    );
    const monthNameDay = parseContactCsv(
      "name,mobile,Anniversary\nTest,9876543210,Aug 14 2026\n",
      occasionOptions,
    );

    expect(dotted.errors).toHaveLength(0);
    expect(dotted.rows[0]?.input.occasions).toEqual({
      anniversary: "14.08.2026",
    });
    expect(iso.errors).toHaveLength(0);
    expect(iso.rows[0]?.input.occasions).toEqual({
      anniversary: "2024-12-05",
    });
    expect(dayMonthName.errors).toHaveLength(0);
    expect(dayMonthName.rows[0]?.input.occasions).toEqual({
      anniversary: "14 Aug 2026",
    });
    expect(monthNameDay.errors).toHaveLength(0);
    expect(monthNameDay.rows[0]?.input.occasions).toEqual({
      anniversary: "Aug 14 2026",
    });
  });

  it("rejects invalid occasion date formats", () => {
    const invalid = parseContactCsv(
      "name,mobile,Anniversary\nTest,9876543210,not-a-date\n",
      occasionOptions,
    );

    expect(invalid.errors[0]?.message).toBe(
      "Invalid date format (expected DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, YYYY-MM-DD, or DD Mon YYYY)",
    );
  });

  it("labels occasion template columns with the expected date format", () => {
    expect(buildContactCsvTemplate([{ name: "Anniversary" }])).toContain(
      "Anniversary (DD-MM-YYYY)",
    );
  });
});
