import { contactCsvRowSchema } from "@/lib/validation/contact";
import type { ContactCsvRowInput } from "@/lib/validation/contact";

import {
  normalizeCsvOccasionDateToIso,
  parseOccasionDate,
  type OccasionDateParts,
} from "./dates";
import { ContactValidationError } from "./errors";
import { normalizeMobile } from "./mobile";

export type PreparedContactRowData = {
  name: string;
  mobile: string;
  email: string | null;
  occasionDates: Record<string, OccasionDateParts>;
  categoryName: string | null;
  address: string | null;
  note: string | null;
  attributes: Record<string, string | number | boolean>;
  isActive: boolean;
};

export type PreparedContactRow =
  | {
      ok: true;
      rowNumber: number;
      data: PreparedContactRowData;
    }
  | {
      ok: false;
      rowNumber: number;
      message: string;
    };

function mapInputToRow(input: ContactCsvRowInput): PreparedContactRowData {
  const schemaParsed = contactCsvRowSchema.parse(input);
  const mobile = normalizeMobile(schemaParsed.mobile);

  const occasionDates: Record<string, OccasionDateParts> = {};
  for (const [key, value] of Object.entries(schemaParsed.occasions ?? {})) {
    occasionDates[key] = parseOccasionDate(normalizeCsvOccasionDateToIso(value));
  }

  const categoryName = schemaParsed.categoryName?.trim() || null;
  const attributes: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(schemaParsed.attributes ?? {})) {
    if (value !== null) {
      attributes[key] = value;
    }
  }

  return {
    name: schemaParsed.name.trim(),
    mobile,
    email: schemaParsed.email?.trim() || null,
    occasionDates,
    categoryName: categoryName ?? null,
    address: schemaParsed.address?.trim() || null,
    note: schemaParsed.note?.trim() || null,
    attributes,
    isActive: schemaParsed.isActive ?? true,
  };
}

export function prepareContactImportRow(
  rowNumber: number,
  input: ContactCsvRowInput,
): PreparedContactRow {
  const schemaParsed = contactCsvRowSchema.safeParse(input);
  if (!schemaParsed.success) {
    const firstIssue = schemaParsed.error.issues[0];
    return {
      ok: false,
      rowNumber,
      message: firstIssue?.message ?? "Invalid contact input",
    };
  }

  try {
    return {
      ok: true,
      rowNumber,
      data: mapInputToRow(schemaParsed.data),
    };
  } catch (error) {
    return {
      ok: false,
      rowNumber,
      message:
        error instanceof ContactValidationError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Invalid contact row",
    };
  }
}
