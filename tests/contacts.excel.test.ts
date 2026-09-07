import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { parseContactExcel } from "@/lib/contacts/excel";

function buildWorkbookBuffer(
  rows: Array<Array<string | number | Date>>,
): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Contacts");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseContactExcel", () => {
  it("parses the first worksheet with CSV-compatible headers", () => {
    const buffer = buildWorkbookBuffer([
      [
        "name",
        "mobile",
        "dateOfBirth",
        "category",
        "address",
        "isActive",
      ],
      [
        "Ada Lovelace",
        "+919876543210",
        "15-01-1990",
        "VIP",
        "London",
        "true",
      ],
      ["Bad Row", "", "", "", "", "true"],
    ]);

    const parsed = parseContactExcel(buffer, {
      occasionKeyByHeader: { dateofbirth: "birthday" },
    });

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.input).toMatchObject({
      name: "Ada Lovelace",
      mobile: "+919876543210",
      occasions: { birthday: "15-01-1990" },
      categoryName: "VIP",
      address: "London",
      isActive: true,
    });
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0]?.message).toMatch(/mobile/i);
  });

  it("rejects workbooks without required columns", () => {
    const buffer = buildWorkbookBuffer([
      ["fullName", "email"],
      ["Ada", "ada@example.com"],
    ]);

    expect(() => parseContactExcel(buffer)).toThrow(/Missing required column/i);
  });

  it("accepts phone as an alias for mobile", () => {
    const buffer = buildWorkbookBuffer([
      ["name", "phone", "dateOfBirth"],
      ["Ada Lovelace", "+919876543210", "15-01-1990"],
    ]);

    const parsed = parseContactExcel(buffer, {
      occasionKeyByHeader: { dateofbirth: "birthday" },
    });
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.input.mobile).toBe("+919876543210");
  });

  it("preserves displayed Excel date text for strict validation", () => {
    const buffer = buildWorkbookBuffer([
      ["name", "mobile", "dateOfBirth"],
      ["Ada Lovelace", "+919876543210", "15-01-1990"],
    ]);

    const parsed = parseContactExcel(buffer, {
      occasionKeyByHeader: { dateofbirth: "birthday" },
    });
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.input.occasions?.birthday).toBe("15-01-1990");
  });

  it("accepts slash-separated Excel occasion dates as day-month-year", () => {
    const buffer = buildWorkbookBuffer([
      ["name", "mobile", "Anniversary"],
      ["Megha", "8177859602", "12/05/2002"],
    ]);

    const parsed = parseContactExcel(buffer, {
      occasionKeyByHeader: { anniversary: "anniversary" },
    });

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows[0]?.input.occasions?.anniversary).toBe("12/05/2002");
  });

  it("formats Excel date cells with a four-digit year for import validation", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["name", "mobile", "Birthday"],
      ["Harshad", "9325964965", new Date(Date.UTC(1987, 0, 6))],
    ]);
    sheet.C2!.z = "m/d/yy";
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Contacts");
    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;

    const parsed = parseContactExcel(buffer, {
      occasionKeyByHeader: { birthday: "birthday" },
    });

    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows[0]?.input.occasions?.birthday).toBe("6/1/1987");
  });
});
