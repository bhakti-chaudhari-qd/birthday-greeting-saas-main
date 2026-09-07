import { prisma } from "@/lib/db";
import { listContactFieldDefinitions } from "@/lib/contact-fields/service";
import { listOccasions } from "@/lib/occasions/service";
import type { ListContactsQuery } from "@/lib/validation/contact";

import {
  MAX_CONTACT_EXPORT_ROWS,
  serializeContactsToCsv,
} from "./csv";
import { buildContactListWhere, serializeContact } from "./serialize";

export type ContactExportQuery = Pick<
  ListContactsQuery,
  "search" | "isActive" | "categoryId" | "occasionId"
> & {
  cursor?: string;
};

export async function exportContactsCsv(
  organizationId: string,
  query: ContactExportQuery,
): Promise<{
  csv: string;
  total: number;
  truncated: boolean;
  nextCursor: string | null;
}> {
  const where = buildContactListWhere(organizationId, {
    search: query.search,
    isActive: query.isActive,
    categoryId: query.categoryId,
    occasionId: query.occasionId,
  });

  const [total, contacts, attributeFields, occasions] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        occasionDates: {
          include: { occasion: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1,
          }
        : {}),
      take: MAX_CONTACT_EXPORT_ROWS,
    }),
    listContactFieldDefinitions(organizationId, { activeOnly: true }),
    listOccasions(organizationId),
  ]);

  const nextCursor =
    contacts.length === MAX_CONTACT_EXPORT_ROWS
      ? (contacts[contacts.length - 1]?.id ?? null)
      : null;

  return {
    csv: serializeContactsToCsv(
      contacts.map(serializeContact),
      attributeFields,
      occasions,
    ),
    total,
    truncated: Boolean(nextCursor),
    nextCursor,
  };
}

export async function exportContactsCsvByIds(
  organizationId: string,
  ids: string[],
): Promise<{ csv: string; total: number; truncated: boolean }> {
  const uniqueIds = [...new Set(ids)];
  const where = {
    organizationId,
    id: { in: uniqueIds },
  };

  const [total, contacts, attributeFields, occasions] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        occasionDates: {
          include: { occasion: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: MAX_CONTACT_EXPORT_ROWS,
    }),
    listContactFieldDefinitions(organizationId, { activeOnly: true }),
    listOccasions(organizationId),
  ]);

  return {
    csv: serializeContactsToCsv(
      contacts.map(serializeContact),
      attributeFields,
      occasions,
    ),
    total,
    truncated: total > MAX_CONTACT_EXPORT_ROWS,
  };
}

export { MAX_CONTACT_EXPORT_ROWS };
