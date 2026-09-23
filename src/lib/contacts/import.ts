import { prisma } from "@/lib/db";
import { listOccasions } from "@/lib/occasions/service";
import { contactCsvRowSchema } from "@/lib/validation/contact";
import type { CreateContactInput, UpdateContactInput } from "@/lib/validation/contact";

import {
  MAX_CONTACT_IMPORT_ROWS,
  normalizeCsvHeaderKey,
  parseContactCsv,
  type ContactCsvRowError,
  type ParseContactCsvResult,
} from "./csv";
import {
  ContactConflictError,
  ContactLimitError,
  ContactValidationError,
} from "./errors";
import { decodeExcelBase64, parseContactExcel } from "./excel";
import { resolveImportFieldMappings } from "./import-field-mappings";
import { normalizeMobile } from "./mobile";
import { createContact, updateContact } from "./service";
import { normalizeCsvOccasionDateToIso } from "./dates";

export type ContactImportSummary = {
  created: number;
  updated: number;
  skippedDuplicate: number;
  skippedLimit: number;
  invalid: number;
  errors: ContactCsvRowError[];
};

function buildContactInput(
  row: {
    name: string;
    mobile: string;
    email?: string | null;
    categoryName: string | null;
    address: string | null;
    note: string | null;
    attributes: Record<string, string | number | boolean>;
    isActive: boolean;
  },
  occasionDates: Record<string, string | null>,
): CreateContactInput {
  return {
    name: row.name,
    mobile: row.mobile,
    email: row.email,
    occasionDates,
    categoryName: row.categoryName,
    address: row.address,
    note: row.note,
    attributes: row.attributes,
    isActive: row.isActive,
  };
}

function buildContactUpdateInput(contactInput: CreateContactInput): UpdateContactInput {
  return {
    name: contactInput.name,
    email: contactInput.email,
    occasionDates: contactInput.occasionDates,
    categoryName: contactInput.categoryName,
    address: contactInput.address,
    note: contactInput.note,
    attributes: contactInput.attributes,
    isActive: contactInput.isActive,
  };
}

function normalizeImportAttributes(
  attributes: Record<string, string | number | boolean | null> | undefined,
): Record<string, string | number | boolean> {
  const normalized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(attributes ?? {})) {
    if (value !== null) {
      normalized[key] = value;
    }
  }
  return normalized;
}

async function importParsedContacts(
  organizationId: string,
  parsed: ParseContactCsvResult,
  duplicateInFileLabel: string,
  options: { addedByPlatformAdmin?: boolean } = {},
): Promise<ContactImportSummary> {
  const errors: ContactCsvRowError[] = [...parsed.errors];
  let created = 0;
  let updated = 0;
  let skippedDuplicate = 0;
  let skippedLimit = 0;
  let invalid = parsed.errors.length;
  let limitReached = false;

  const seenMobiles = new Set<string>();
  const occasions = await listOccasions(organizationId);
  const occasionIdByKey = new Map(
    occasions.map((occasion) => [normalizeCsvHeaderKey(occasion.name), occasion.id]),
  );

  for (const row of parsed.rows) {
    if (limitReached) {
      skippedLimit += 1;
      errors.push({
        row: row.rowNumber,
        message: "Skipped because contact limit was reached",
      });
      continue;
    }

    const schemaParsed = contactCsvRowSchema.safeParse(row.input);
    if (!schemaParsed.success) {
      invalid += 1;
      const firstIssue = schemaParsed.error.issues[0];
      errors.push({
        row: row.rowNumber,
        message: firstIssue?.message ?? "Invalid contact input",
      });
      continue;
    }

    let mobileKey: string;
    try {
      mobileKey = normalizeMobile(schemaParsed.data.mobile);
    } catch (error) {
      invalid += 1;
      errors.push({
        row: row.rowNumber,
        message:
          error instanceof Error ? error.message : "Invalid mobile number",
      });
      continue;
    }

    if (seenMobiles.has(mobileKey)) {
      skippedDuplicate += 1;
      errors.push({
        row: row.rowNumber,
        message: duplicateInFileLabel,
      });
      continue;
    }

    const occasionDates: Record<string, string | null> = {};
    for (const [occasionKey, value] of Object.entries(
      schemaParsed.data.occasions ?? {},
    )) {
      const occasionId = occasionIdByKey.get(normalizeCsvHeaderKey(occasionKey));
      if (occasionId) {
        occasionDates[occasionId] = normalizeCsvOccasionDateToIso(value);
      }
    }

    const contactInput = buildContactInput(
      {
        ...schemaParsed.data,
        attributes: normalizeImportAttributes(schemaParsed.data.attributes),
      },
      occasionDates,
    );

    const existing = await prisma.contact.findFirst({
      where: { organizationId, mobile: mobileKey },
      select: { id: true },
    });

    try {
      if (existing) {
        const updateInput = buildContactUpdateInput(contactInput);
        await updateContact(
          organizationId,
          existing.id,
          updateInput,
        );
        seenMobiles.add(mobileKey);
        updated += 1;
        continue;
      }

      await createContact(organizationId, contactInput, {
        addedByPlatformAdmin: options.addedByPlatformAdmin,
      });
      seenMobiles.add(mobileKey);
      created += 1;
    } catch (error) {
      if (error instanceof ContactConflictError) {
        // Race: another writer created the same mobile - try update once.
        const raced = await prisma.contact.findFirst({
          where: { organizationId, mobile: mobileKey },
          select: { id: true },
        });
        if (raced) {
          const updateInput = buildContactUpdateInput(contactInput);
          try {
            await updateContact(
              organizationId,
              raced.id,
              updateInput,
            );
            seenMobiles.add(mobileKey);
            updated += 1;
            continue;
          } catch (updateError) {
            if (updateError instanceof ContactLimitError) {
              limitReached = true;
              skippedLimit += 1;
              errors.push({
                row: row.rowNumber,
                message: updateError.message,
              });
              continue;
            }
            if (updateError instanceof ContactValidationError) {
              invalid += 1;
              errors.push({
                row: row.rowNumber,
                message: updateError.message,
              });
              continue;
            }
            throw updateError;
          }
        }
        seenMobiles.add(mobileKey);
        skippedDuplicate += 1;
        errors.push({
          row: row.rowNumber,
          message: "A contact with this mobile already exists",
        });
        continue;
      }

      if (error instanceof ContactLimitError) {
        limitReached = true;
        skippedLimit += 1;
        errors.push({
          row: row.rowNumber,
          message: error.message,
        });
        continue;
      }

      if (error instanceof ContactValidationError) {
        invalid += 1;
        errors.push({
          row: row.rowNumber,
          message: error.message,
        });
        continue;
      }

      throw error;
    }
  }

  return {
    created,
    updated,
    skippedDuplicate,
    skippedLimit,
    invalid,
    errors: errors.slice(0, 100),
  };
}

/**
 * Import contacts from CSV text.
 * Existing mobiles are updated; in-file duplicate mobiles are skipped.
 * Contact-limit exhaustion stops further creates/activations.
 */
export async function importContactsFromCsv(
  organizationId: string,
  csvText: string,
  options: {
    fieldMappings?: Array<{ header: string; action: "ignore" | "existing" | "create"; fieldKey?: string; label?: string }>;
    addedByPlatformAdmin?: boolean;
  } = {},
): Promise<ContactImportSummary> {
  let parsed: ParseContactCsvResult;
  try {
    const resolved = await resolveImportFieldMappings(
      organizationId,
      options.fieldMappings,
    );
    parsed = parseContactCsv(csvText, resolved);
  } catch (error) {
    throw new ContactValidationError(
      error instanceof Error ? error.message : "Invalid CSV",
    );
  }

  return importParsedContacts(organizationId, parsed, "Duplicate mobile in this CSV", {
    addedByPlatformAdmin: options.addedByPlatformAdmin,
  });
}

/**
 * Import contacts from an Excel workbook (.xlsx / .xls) as base64.
 * Uses the first worksheet. Same column rules as CSV import.
 */
export async function importContactsFromExcelBase64(
  organizationId: string,
  excelBase64: string,
  options: {
    fieldMappings?: Array<{ header: string; action: "ignore" | "existing" | "create"; fieldKey?: string; label?: string }>;
    addedByPlatformAdmin?: boolean;
  } = {},
): Promise<ContactImportSummary> {
  let parsed: ParseContactCsvResult;
  try {
    const buffer = decodeExcelBase64(excelBase64);
    const resolved = await resolveImportFieldMappings(
      organizationId,
      options.fieldMappings,
    );
    parsed = parseContactExcel(buffer, resolved);
  } catch (error) {
    throw new ContactValidationError(
      error instanceof Error ? error.message : "Invalid Excel file",
    );
  }

  return importParsedContacts(
    organizationId,
    parsed,
    "Duplicate mobile in this Excel file",
    { addedByPlatformAdmin: options.addedByPlatformAdmin },
  );
}

export { MAX_CONTACT_IMPORT_ROWS };
