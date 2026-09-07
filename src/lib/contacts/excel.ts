import * as XLSX from "xlsx";

import {
  parseContactTable,
  type ContactCsvParseOptions,
  type ParseContactCsvResult,
} from "./csv";

const MAX_EXCEL_BYTES = 50_000_000;

function formatExcelDateCell(value: number | Date): string {
  if (value instanceof Date) {
    return [
      String(value.getUTCDate()),
      String(value.getUTCMonth() + 1),
      String(value.getUTCFullYear()).padStart(4, "0"),
    ].join("/");
  }

  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) {
    return String(value);
  }

  return [
    String(parsed.d),
    String(parsed.m),
    String(parsed.y).padStart(4, "0"),
  ].join("/");
}

function cellToString(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === null || cell.v === undefined) {
    return "";
  }

  if (cell.t === "d" && cell.v instanceof Date) {
    return formatExcelDateCell(cell.v);
  }

  if (
    cell.t === "n" &&
    typeof cell.v === "number" &&
    Number.isFinite(cell.v) &&
    cell.z &&
    XLSX.SSF.is_date(cell.z)
  ) {
    return formatExcelDateCell(cell.v);
  }

  if (typeof cell.v === "number" && Number.isFinite(cell.v)) {
    return String(cell.v);
  }

  if (typeof cell.v === "boolean") {
    return cell.v ? "true" : "false";
  }

  return String(cell.v).trim();
}

/** Exported so the browser-side import preview can reuse the same cell mapping. */
export function worksheetToTable(sheet: XLSX.WorkSheet): string[][] {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  const rows: string[][] = [];

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row: string[] = [];
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      row.push(cellToString(sheet[address]));
    }
    rows.push(row);
  }

  return rows
    .filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/**
 * Parses the first worksheet of an Excel workbook (.xlsx / .xls)
 * using the same headers and row rules as CSV import.
 */
export function parseContactExcel(
  bytes: ArrayBuffer | Uint8Array | Buffer,
  options: ContactCsvParseOptions = {},
): ParseContactCsvResult {
  const size =
    bytes instanceof ArrayBuffer
      ? bytes.byteLength
      : Buffer.isBuffer(bytes)
        ? bytes.length
        : bytes.byteLength;

  if (size === 0) {
    throw new Error("Excel file is empty");
  }

  if (size > MAX_EXCEL_BYTES) {
    throw new Error(
      `Excel file is too large (max ${Math.floor(MAX_EXCEL_BYTES / 1_000_000)} MB)`,
    );
  }

  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(bytes, {
      type: "buffer",
      cellDates: false,
      cellNF: true,
      cellText: false,
      dateNF: "d/m/yyyy",
    });
  } catch {
    throw new Error("Could not read Excel file. Use .xlsx or .xls");
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Excel file has no worksheets");
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("Excel worksheet could not be opened");
  }

  const table = worksheetToTable(sheet);
  if (table.length === 0) {
    throw new Error("Excel worksheet is empty");
  }

  return parseContactTable(table, options);
}

export function decodeExcelBase64(excelBase64: string): Buffer {
  const normalized = excelBase64
    .trim()
    .replace(/^data:[^;]+;base64,/i, "");

  if (!normalized) {
    throw new Error("Excel content is required");
  }

  const buffer = Buffer.from(normalized, "base64");
  if (buffer.length === 0) {
    throw new Error("Excel content is empty");
  }

  return buffer;
}

export { MAX_EXCEL_BYTES };
