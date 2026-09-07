import { ContactFieldType, Prisma } from "@prisma/client";

import {
  createContactFieldDefinition,
  listContactFieldDefinitions,
} from "@/lib/contact-fields/service";
import { normalizeContactFieldKey } from "@/lib/contact-fields/keys";
import { listOccasions } from "@/lib/occasions/service";
import type { ImportFieldMappingInput } from "@/lib/validation/contact-csv";

import { normalizeCsvHeaderKey } from "./csv";

export type ResolvedImportFieldMappings = {
  attributeKeyByHeader: Record<string, string>;
  occasionKeyByHeader: Record<string, string>;
};

export function buildExistingFieldHeaderMap(
  fields: Array<{ key: string; label: string }>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const field of fields) {
    map[normalizeCsvHeaderKey(field.key)] = field.key;
    map[normalizeCsvHeaderKey(field.label)] = field.key;
  }
  return map;
}

export function parseStoredImportFieldMappings(
  value: Prisma.JsonValue | null | undefined,
): ImportFieldMappingInput[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is ImportFieldMappingInput =>
      Boolean(
        item &&
          typeof item === "object" &&
          "header" in item &&
          "action" in item,
      ),
  );
}

export async function resolveImportFieldMappings(
  organizationId: string,
  mappings: ImportFieldMappingInput[] = [],
): Promise<ResolvedImportFieldMappings> {
  const [fields, occasions] = await Promise.all([
    listContactFieldDefinitions(organizationId, { activeOnly: true }),
    listOccasions(organizationId),
  ]);
  const byKey = new Map(fields.map((field) => [field.key, field] as const));
  const attributeKeyByHeader = buildExistingFieldHeaderMap(fields);
  const occasionKeyByHeader = buildExistingFieldHeaderMap(
    occasions.map((occasion) => ({
      key: normalizeCsvHeaderKey(occasion.name),
      label: occasion.name,
    })),
  );
  const createdKeys = new Set<string>();

  for (const mapping of mappings) {
    const headerKey = normalizeCsvHeaderKey(mapping.header);
    if (!headerKey || mapping.action === "ignore") {
      continue;
    }

    if (mapping.action === "existing") {
      const key = mapping.fieldKey?.trim();
      if (key && byKey.has(key)) {
        attributeKeyByHeader[headerKey] = key;
      }
      continue;
    }

    const label = mapping.label?.trim() || mapping.header.trim();
    const key = normalizeContactFieldKey(mapping.fieldKey?.trim() || label);
    if (!createdKeys.has(key) && !byKey.has(key)) {
      const created = await createContactFieldDefinition(organizationId, {
        key,
        label,
        type: ContactFieldType.TEXT,
      });
      byKey.set(created.key, created);
      createdKeys.add(created.key);
    }
    if (byKey.has(key)) {
      attributeKeyByHeader[headerKey] = key;
    }
  }

  return { attributeKeyByHeader, occasionKeyByHeader };
}
