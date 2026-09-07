import {
  contactCsvRowSchema,
  type ContactCsvRowInput,
} from "@/lib/validation/contact";
import { ZodError } from "zod";

import type { SerializedContact } from "./serialize";

export const CONTACT_CSV_HEADERS = [
  "name",
  "mobile",
  "email",
  "category",
  "address",
  "note",
  "isActive",
] as const;

export type ContactCsvHeader = (typeof CONTACT_CSV_HEADERS)[number];

export const MAX_CONTACT_IMPORT_ROWS = 500_000;
export const MAX_CONTACT_EXPORT_ROWS = 500_000;

export type { ContactCsvRowInput };

export type ParsedContactCsvRow = {
  rowNumber: number;
  input: ContactCsvRowInput;
};

export type ContactCsvRowError = {
  row: number;
  message: string;
};

export type ParseContactCsvResult = {
  rows: ParsedContactCsvRow[];
  errors: ContactCsvRowError[];
};

export type ContactCsvParseOptions = {
  attributeKeyByHeader?: Record<string, string>;
  occasionKeyByHeader?: Record<string, string>;
  maxRows?: number;
};

const HEADER_ALIASES: Record<string, ContactCsvHeader> = {
  name: "name",
  fullname: "name",
  full_name: "name",
  contactname: "name",
  contact_name: "name",
  mobile: "mobile",
  mobilenumber: "mobile",
  mobile_number: "mobile",
  mobileno: "mobile",
  mobile_no: "mobile",
  phone: "mobile",
  phonenumber: "mobile",
  phone_number: "mobile",
  phoneno: "mobile",
  phone_no: "mobile",
  contactnumber: "mobile",
  contact_number: "mobile",
  cellphone: "mobile",
  cell: "mobile",
  whatsapp: "mobile",
  whatsappnumber: "mobile",
  whatsapp_number: "mobile",
  email: "email",
  emailaddress: "email",
  email_address: "email",
  mail: "email",
  category: "category",
  address: "address",
  note: "note",
  notes: "note",
  remark: "note",
  remarks: "note",
  isactive: "isActive",
  is_active: "isActive",
  active: "isActive",
};

function detectCsvDelimiter(text: string): "," | "\t" {
  const firstDataLine =
    text
      .replace(/^\uFEFF/, "")
      .split(/\r\n|\n|\r/)
      .find((line) => line.trim().length > 0) ?? "";
  const commaCount = (firstDataLine.match(/,/g) ?? []).length;
  const tabCount = (firstDataLine.match(/\t/g) ?? []).length;
  return tabCount > commaCount ? "\t" : ",";
}

/**
 * Minimal RFC4180-style CSV parser: delimiters, quotes, escaped quotes, CRLF/LF.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const input = text.replace(/^\uFEFF/, "");
  const delimiter = detectCsvDelimiter(input);

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]!;
    const next = input[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      if (next === "\n") {
        continue;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw new Error("CSV has an unclosed quoted field");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function stripCsvDateFormatHint(header: string): string {
  return header.replace(/\s*\(DD-MM-YYYY\)\s*$/i, "").trim();
}

export function buildContactCsvTemplate(
  occasions: Array<{ name: string }> = [],
): string {
  return `${[
    ...CONTACT_CSV_HEADERS,
    ...occasions.map((occasion) => `${occasion.name} (DD-MM-YYYY)`),
  ].map(escapeCsvField).join(",")}\n`;
}

export function serializeContactsToCsv(
  contacts: Array<
    Pick<
      SerializedContact,
      | "name"
      | "mobile"
      | "email"
      | "occasionDateDetails"
      | "categoryName"
      | "address"
      | "note"
      | "isActive"
    >
    & { attributes?: unknown }
  >,
  attributeFields: Array<{ key: string; label: string }> = [],
  occasions: Array<{ id: string; name: string }> = [],
): string {
  const headers = [
    ...CONTACT_CSV_HEADERS,
    ...occasions.map((occasion) => occasion.name),
    ...attributeFields.map((field) => field.label),
  ];
  const lines = [headers.map(escapeCsvField).join(",")];

  for (const contact of contacts) {
    const attributes =
      contact.attributes &&
      typeof contact.attributes === "object" &&
      !Array.isArray(contact.attributes)
        ? (contact.attributes as Record<string, unknown>)
        : {};
    const occasionDateById = new Map(
      contact.occasionDateDetails.map((entry) => [entry.occasionId, entry.date]),
    );
    lines.push(
      [
        escapeCsvField(contact.name),
        escapeCsvField(contact.mobile),
        escapeCsvField(contact.email ?? ""),
        escapeCsvField(contact.categoryName ?? ""),
        escapeCsvField(contact.address ?? ""),
        escapeCsvField(contact.note ?? ""),
        contact.isActive ? "true" : "false",
        ...occasions.map((occasion) =>
          escapeCsvField(occasionDateById.get(occasion.id) ?? ""),
        ),
        ...attributeFields.map((field) =>
          escapeCsvField(String(attributes[field.key] ?? "")),
        ),
      ].join(","),
    );
  }

  return `${lines.join("\n")}\n`;
}

export function normalizeCsvHeaderKey(raw: string): string {
  const stripped = stripCsvDateFormatHint(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return stripped.replace(/\s+/g, "");
}

export function resolveContactCsvHeader(raw: string): ContactCsvHeader | null {
  const stripped = stripCsvDateFormatHint(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const key = normalizeCsvHeaderKey(raw);
  const underscored = stripped.replace(/\s+/g, "_");
  return HEADER_ALIASES[key] ?? HEADER_ALIASES[underscored] ?? null;
}

function parseIsActive(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (!value) {
    return true;
  }
  if (["true", "1", "yes", "y"].includes(value)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(value)) {
    return false;
  }
  throw new Error('isActive must be "true" or "false"');
}

function parseCategoryName(raw: string): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  if (value.length > 50) {
    throw new Error("category must be 50 characters or fewer");
  }
  return value;
}

function parseNote(raw: string): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  if (value.length > 1000) {
    throw new Error("note must be 1000 characters or fewer");
  }
  return value;
}

function parseEmail(raw: string): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  if (value.length > 254) {
    throw new Error("email must be 254 characters or fewer");
  }
  return value;
}

function mapRowToInput(
  cells: string[],
  columnIndex: Partial<Record<ContactCsvHeader, number>>,
  attributeColumnIndex: Record<string, number>,
  occasionColumnIndex: Record<string, number>,
): ContactCsvRowInput {
  const get = (header: ContactCsvHeader) => {
    const index = columnIndex[header];
    if (index === undefined || index < 0) {
      return "";
    }
    return (cells[index] ?? "").trim();
  };

  const name = get("name");
  const mobile = get("mobile");
  const emailRaw = get("email");
  const categoryRaw = get("category");
  const addressRaw = get("address");
  const noteRaw = get("note");
  const isActiveRaw = get("isActive");

  if (!name) {
    throw new Error("name is required");
  }
  if (!mobile) {
    throw new Error("mobile is required");
  }

  const attributes: Record<string, string> = {};
  for (const [key, index] of Object.entries(attributeColumnIndex)) {
    const value = (cells[index] ?? "").trim();
    if (value) {
      attributes[key] = value;
    }
  }
  const occasions: Record<string, string> = {};
  for (const [key, index] of Object.entries(occasionColumnIndex)) {
    const value = (cells[index] ?? "").trim();
    if (value) {
      occasions[key] = value;
    }
  }

  return contactCsvRowSchema.parse({
    name,
    mobile,
    email: parseEmail(emailRaw),
    occasions,
    categoryName: parseCategoryName(categoryRaw),
    address: addressRaw ? addressRaw : null,
    note: parseNote(noteRaw),
    attributes,
    isActive: parseIsActive(isActiveRaw),
  });
}

/**
 * Parses a header + data table into contact create inputs.
 * Row numbers are 1-based and include the header as row 1.
 */
export function parseContactTable(
  table: string[][],
  options: ContactCsvParseOptions = {},
): ParseContactCsvResult {
  if (table.length === 0) {
    throw new Error("Import file is empty");
  }

  const headerCells = table[0]!;
  const columnIndex: Partial<Record<ContactCsvHeader, number>> = {};
  const attributeColumnIndex: Record<string, number> = {};
  const occasionColumnIndex: Record<string, number> = {};
  const seen = new Set<ContactCsvHeader>();
  const seenAttributes = new Set<string>();
  const seenOccasions = new Set<string>();

  for (let i = 0; i < headerCells.length; i += 1) {
    const rawHeader = headerCells[i] ?? "";
    const mapped = resolveContactCsvHeader(rawHeader);
    if (!mapped) {
      const normalized = normalizeCsvHeaderKey(rawHeader);
      const occasionKey = options.occasionKeyByHeader?.[normalized];
      if (occasionKey) {
        if (seenOccasions.has(occasionKey)) {
          throw new Error(`Duplicate occasion column "${occasionKey}"`);
        }
        seenOccasions.add(occasionKey);
        occasionColumnIndex[occasionKey] = i;
        continue;
      }

      const attributeKey = options.attributeKeyByHeader?.[normalized];
      if (attributeKey) {
        if (seenAttributes.has(attributeKey)) {
          throw new Error(`Duplicate attribute column "${attributeKey}"`);
        }
        seenAttributes.add(attributeKey);
        attributeColumnIndex[attributeKey] = i;
      }
      continue;
    }
    if (seen.has(mapped)) {
      throw new Error(`Duplicate column "${mapped}"`);
    }
    seen.add(mapped);
    columnIndex[mapped] = i;
  }

  for (const required of ["name", "mobile"] as const) {
    if (columnIndex[required] === undefined) {
      throw new Error(
        `Missing required column "${required}". Use headers like name and mobile (phone also works). Download the template for the full list.`,
      );
    }
  }

  const dataRows = table.slice(1);
  const rowCap = options.maxRows ?? MAX_CONTACT_IMPORT_ROWS;
  if (dataRows.length > rowCap) {
    throw new Error(
      `Import has too many rows (max ${rowCap} contacts per import)`,
    );
  }

  const rows: ParsedContactCsvRow[] = [];
  const errors: ContactCsvRowError[] = [];

  for (let i = 0; i < dataRows.length; i += 1) {
    const rowNumber = i + 2;
    const cells = dataRows[i]!;

    try {
      const input = mapRowToInput(
        cells,
        columnIndex,
        attributeColumnIndex,
        occasionColumnIndex,
      );
      rows.push({ rowNumber, input });
    } catch (error) {
      const zodIssue =
        error instanceof ZodError ? error.issues[0]?.message : null;
      errors.push({
        row: rowNumber,
        message: zodIssue ?? (error instanceof Error ? error.message : "Invalid contact row"),
      });
    }
  }

  return { rows, errors };
}

/**
 * Parses contact CSV text into create inputs.
 * Row numbers are 1-based and include the header as row 1.
 */
export function parseContactCsv(
  text: string,
  options: ContactCsvParseOptions = {},
): ParseContactCsvResult {
  if (!text.trim()) {
    throw new Error("CSV is empty");
  }

  const table = parseCsv(text);
  if (table.length === 0) {
    throw new Error("CSV is empty");
  }

  return parseContactTable(table, options);
}
