"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";

import { Modal } from "@/components/ui/modal";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";
import {
  normalizeCsvHeaderKey,
  parseCsv,
  parseContactTable,
  resolveContactCsvHeader,
} from "@/lib/contacts/csv";
import { worksheetToTable } from "@/lib/contacts/excel";

export type CsvImportDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Hands the real file off to the existing import pipeline; dialog closes right after. */
  onStartImport: (
    file: File,
    fieldMappings: ImportFieldMapping[],
  ) => void;
};

const PREVIEW_ROW_LIMIT = 8;

type PreviewState = {
  file: File;
  headers: string[];
  totalRows: number;
  rows: Array<{
    name: string;
    mobile: string;
    category: string;
    occasions: string;
  }>;
  errorCount: number;
  unknownHeaders: string[];
};

type ContactFieldDefinition = {
  id: string;
  key: string;
  label: string;
};

type OccasionOption = {
  id: string;
  name: string;
};

export type ImportFieldMapping = {
  header: string;
  action: "ignore" | "existing" | "create";
  fieldKey?: string;
  label?: string;
};

function isExcelFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".csv")) {
    return false;
  }
  return (
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  );
}

async function tableFromFile(file: File): Promise<string[][]> {
  if (isExcelFile(file)) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), {
      type: "array",
      cellDates: false,
      cellNF: true,
      dateNF: "d/m/yyyy",
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error("Excel file has no worksheets");
    }
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error("Excel worksheet could not be opened");
    }
    return worksheetToTable(sheet);
  }

  const text = await file.text();
  return parseCsv(text);
}

export function CsvImportDialog({
  open,
  onClose,
  onStartImport,
}: CsvImportDialogProps) {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [fieldDefinitions, setFieldDefinitions] = useState<ContactFieldDefinition[]>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, ImportFieldMapping>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPreview(null);
    setFieldMappings({});
    setParseError(null);
    setParsing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileSelected(file: File) {
    const lowerName = file.name.toLowerCase();
    const looksSupported =
      lowerName.endsWith(".csv") ||
      lowerName.endsWith(".xlsx") ||
      lowerName.endsWith(".xls") ||
      file.type === "text/csv" ||
      file.type === "" ||
      isExcelFile(file);

    if (!looksSupported) {
      setParseError("Import a .csv, .xlsx, or .xls file.");
      return;
    }

    setParsing(true);
    setParseError(null);

    try {
      const [fieldsResponse, occasionsResponse] = await Promise.all([
        fetch("/api/v1/contact-fields?isActive=true"),
        fetch("/api/v1/occasions"),
      ]);
      const [fieldsBody, occasionsBody] = await Promise.all([
        fieldsResponse.json(),
        occasionsResponse.json(),
      ]);
      const fields = fieldsResponse.ok
        ? ((fieldsBody.data ?? []) as ContactFieldDefinition[])
        : [];
      const occasions = occasionsResponse.ok
        ? ((occasionsBody.data ?? []) as OccasionOption[])
        : [];
      setFieldDefinitions(fields);

      const table = await tableFromFile(file);
      if (table.length === 0) {
        setParseError("This file is empty.");
        return;
      }

      const previewTable = [table[0]!, ...table.slice(1, 1 + PREVIEW_ROW_LIMIT)];
      const occasionKeyByHeader = Object.fromEntries(
        occasions.flatMap((occasion) => {
          const key = normalizeCsvHeaderKey(occasion.name);
          return [
            [key, key],
            [normalizeCsvHeaderKey(occasion.id), key],
          ];
        }),
      );
      const { rows, errors } = parseContactTable(previewTable, {
        occasionKeyByHeader,
      });
      const existingFieldHeaders = new Set(
        fields.flatMap((field) => [
          normalizeCsvHeaderKey(field.key),
          normalizeCsvHeaderKey(field.label),
        ]),
      );
      const existingOccasionHeaders = new Set(
        occasions.flatMap((occasion) => [
          normalizeCsvHeaderKey(occasion.name),
          normalizeCsvHeaderKey(occasion.id),
        ]),
      );
      const headers = table[0]!;
      const unknownHeaders = headers.filter((header) => {
        const normalized = normalizeCsvHeaderKey(header);
        return (
          normalized &&
          !resolveContactCsvHeader(header) &&
          !existingOccasionHeaders.has(normalized) &&
          !existingFieldHeaders.has(normalized)
        );
      });
      setFieldMappings(
        Object.fromEntries(
          unknownHeaders.map((header) => [
            header,
            { header, action: "ignore" as const },
          ]),
        ),
      );

      setPreview({
        file,
        headers,
        totalRows: table.length - 1,
        errorCount: errors.length,
        unknownHeaders,
        rows: rows.map((row) => ({
          name: row.input.name,
          mobile: row.input.mobile,
          category: row.input.categoryName ?? "—",
          occasions:
            Object.entries(row.input.occasions ?? {})
              .map(([key, value]) => `${key}: ${value}`)
              .join(", ") || "—",
        })),
      });
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : "Could not read this file.",
      );
    } finally {
      setParsing(false);
    }
  }

  function handleConfirmImport() {
    if (!preview) {
      return;
    }
    onStartImport(preview.file, Object.values(fieldMappings));
    reset();
    onClose();
  }

  function updateMapping(header: string, patch: Partial<ImportFieldMapping>) {
    setFieldMappings((current) => ({
      ...current,
      [header]: {
        ...(current[header] ?? { header, action: "ignore" }),
        ...patch,
      },
    }));
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import CSV" className="max-w-lg">
      {!preview ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-stone-600">
            Upload a .csv, .xlsx, or .xls file with your contacts. We&apos;ll
            show a quick preview before anything is imported.
          </p>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.03]">
            <span className="text-sm font-medium text-stone-800">
              Click to choose a file
            </span>
            <span className="text-xs text-stone-500">
              or drag and drop it here
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFileSelected(file);
                }
              }}
            />
          </label>

          {parsing ? (
            <p className="text-sm text-stone-500">Reading file…</p>
          ) : null}
          {parseError ? (
            <p className="text-sm text-red-600">{parseError}</p>
          ) : null}

          <Link
            href="/api/v1/contacts/import/template"
            className="text-sm font-medium text-primary hover:underline"
          >
            Download Sample CSV
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-stone-900">
              {preview.file.name}
            </p>
            <p className="mt-0.5 text-xs text-stone-500">
              {preview.totalRows.toLocaleString("en-IN")} row
              {preview.totalRows === 1 ? "" : "s"} detected
              {preview.errorCount > 0
                ? ` · ${preview.errorCount} issue${preview.errorCount === 1 ? "" : "s"} in the rows shown below`
                : ""}
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Mobile</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Occasions</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, index) => (
                  <tr
                    key={`${row.mobile}-${index}`}
                    className="border-t border-stone-100"
                  >
                    <td className="px-3 py-2 text-stone-800">{row.name}</td>
                    <td className="px-3 py-2 text-stone-600">{row.mobile}</td>
                    <td className="px-3 py-2 text-stone-600">{row.category}</td>
                    <td className="px-3 py-2 text-stone-600">{row.occasions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.totalRows > preview.rows.length ? (
            <p className="text-xs text-stone-500">
              Showing the first {preview.rows.length} of{" "}
              {preview.totalRows.toLocaleString("en-IN")} rows. The full file
              will be imported.
            </p>
          ) : null}

          {preview.unknownHeaders.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-950">
                Unknown columns detected
              </p>
              <p className="mt-1 text-xs text-amber-900">
                Choose what to do with each column before importing. Unknown
                columns are ignored by default.
              </p>
              <div className="mt-3 flex flex-col gap-3">
                {preview.unknownHeaders.map((header) => {
                  const mapping = fieldMappings[header] ?? {
                    header,
                    action: "ignore" as const,
                  };
                  return (
                    <div
                      key={header}
                      className="rounded-lg border border-amber-200 bg-white p-3"
                    >
                      <p className="text-sm font-medium text-stone-900">{header}</p>
                      <div className="mt-2 grid gap-2 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={mapping.action === "ignore"}
                            onChange={() => updateMapping(header, { action: "ignore" })}
                          />
                          Ignore
                        </label>
                        <label className="flex flex-wrap items-center gap-2">
                          <input
                            type="radio"
                            checked={mapping.action === "existing"}
                            onChange={() =>
                              updateMapping(header, {
                                action: "existing",
                                fieldKey: fieldDefinitions[0]?.key,
                              })
                            }
                          />
                          Map to existing field
                          <select
                            className="rounded border border-stone-300 bg-white px-2 py-1 text-xs"
                            value={mapping.fieldKey ?? ""}
                            disabled={mapping.action !== "existing"}
                            onChange={(event) =>
                              updateMapping(header, {
                                action: "existing",
                                fieldKey: event.target.value,
                              })
                            }
                          >
                            <option value="">Choose field</option>
                            {fieldDefinitions.map((field) => (
                              <option key={field.id} value={field.key}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={mapping.action === "create"}
                            onChange={() =>
                              updateMapping(header, {
                                action: "create",
                                label: header.trim(),
                              })
                            }
                          />
                          Create new field
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={reset}
            >
              Back
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={handleConfirmImport}
            >
              Import
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
