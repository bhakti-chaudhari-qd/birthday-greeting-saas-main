import { describe, expect, it } from "vitest";

import {
  buildContactCsvTemplate,
  parseContactCsv,
  parseContactTable,
  parseCsv,
  serializeContactsToCsv,
} from "@/lib/contacts/csv";

describe("contact CSV helpers", () => {
  it("parses quoted commas and escaped quotes", () => {
    const rows = parseCsv('name,mobile\n"Doe, Jane","+919876543210"\n');
    expect(rows).toEqual([
      ["name", "mobile"],
      ["Doe, Jane", "+919876543210"],
    ]);
  });

  it("maps email, category, address, note, and optional isActive", () => {
    const csv = [
      "name,mobile,email,category,address,note,isActive",
      'Alice,+919876543210,alice@example.com,VIP,"12 MG Road, Pune","Prefers WhatsApp",',
    ].join("\n");

    const parsed = parseContactCsv(csv);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.input).toEqual({
      name: "Alice",
      mobile: "+919876543210",
      email: "alice@example.com",
      occasions: {},
      categoryName: "VIP",
      address: "12 MG Road, Pune",
      note: "Prefers WhatsApp",
      attributes: {},
      isActive: true,
    });
  });

  it("ignores legacy tags column on import", () => {
    const csv = [
      "name,mobile,category,tags,isActive",
      "Bob,+919876543211,VIP,vip|customer,true",
    ].join("\n");
    const parsed = parseContactCsv(csv);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows[0]!.input).toMatchObject({
      name: "Bob",
      categoryName: "VIP",
      isActive: true,
    });
    expect(parsed.rows[0]!.input).not.toHaveProperty("tags");
  });

  it("accepts free-text category names like Relative", () => {
    const csv = ["name,mobile,category", "Bob,+919876543211,Relative"].join(
      "\n",
    );
    const parsed = parseContactCsv(csv);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows[0]!.input.categoryName).toBe("Relative");
  });

  it("parses tab-separated contact exports with categories", () => {
    const text = [
      "name\tmobile\temail\tcategory\taddress\tnote\tisActive\tBirthday\tAnniversary",
      "Megha\t8177859602\tmegha.ishika@gmail.com\tcsv test\t\t\t\t03/09/1984\t12/05/2002",
      "Harshad\t9325964965\tharshadimp@gmail.com\tcsv test\t\t\t\t6/1/1987\t21/12/2016",
    ].join("\n");

    const parsed = parseContactCsv(text, {
      occasionKeyByHeader: {
        birthday: "birthday",
        anniversary: "anniversary",
      },
    });

    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]!.input.categoryName).toBe("csv test");
    expect(parsed.rows[1]!.input.categoryName).toBe("csv test");
  });

  it("collects overly long category as a row error", () => {
    const csv = [
      "name,mobile,category",
      `Bob,+919876543211,${"X".repeat(51)}`,
    ].join("\n");
    const parsed = parseContactCsv(csv);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors[0]?.message).toMatch(/50 characters/i);
  });

  it("collects per-row errors without failing the whole file", () => {
    const csv = [
      "name,mobile",
      ",+919876543210",
      "Bob,+919876543211",
    ].join("\n");

    const parsed = parseContactCsv(csv);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.errors).toEqual([
      { row: 2, message: "name is required" },
    ]);
  });

  it("rejects files above the import row cap", () => {
    const table: string[][] = [["name", "mobile"]];
    for (let i = 0; i < 6; i += 1) {
      table.push([`Person ${i}`, `+9198765${String(i).padStart(5, "0")}`]);
    }

    expect(() => parseContactTable(table, { maxRows: 5 })).toThrow(/too many rows/i);
  });

  it("serializes contacts and builds a template", () => {
    const csv = serializeContactsToCsv([
      {
        name: 'Ann "VIP"',
        mobile: "+919876543210",
        email: "ann@example.com",
        occasionDateDetails: [
          {
            occasionId: "occ-birthday",
            occasionName: "Birthday",
            date: "1990-01-02",
            month: 1,
            day: 2,
          },
          {
            occasionId: "occ-anniversary",
            occasionName: "Anniversary",
            date: "2015-06-01",
            month: 6,
            day: 1,
          },
        ],
        categoryName: "VVIP",
        address: "Lane 1, City",
        note: "Call after 6pm",
        isActive: false,
      },
    ]);

    expect(csv).toContain(
      "name,mobile,email,category,address,note,isActive",
    );
    expect(csv).toContain('"Ann ""VIP"""');
    expect(csv).toContain("ann@example.com");
    expect(csv).toContain("VVIP");
    expect(csv).toContain("Lane 1, City");
    expect(csv).toContain("Call after 6pm");
    expect(csv).toContain("false");
    expect(csv).not.toContain("tags");
    expect(buildContactCsvTemplate()).toBe(
      "name,mobile,email,category,address,note,isActive\n",
    );
  });
});
