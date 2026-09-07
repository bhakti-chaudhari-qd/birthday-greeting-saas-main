import type {
  Contact,
  ContactCategoryDefinition,
  ContactOccasionDate,
  Occasion,
  Prisma,
} from "@prisma/client";

import { formatOccasionDate } from "@/lib/contacts/dates";

type ContactWithCategory = Contact & {
  category?: Pick<ContactCategoryDefinition, "id" | "name"> | null;
  occasionDates?: Array<
    Pick<ContactOccasionDate, "occasionId" | "date" | "month" | "day"> & {
      occasion: Pick<Occasion, "id" | "name">;
    }
  >;
};

export function serializeContact(contact: ContactWithCategory) {
  const occasionDates: Record<string, string> = {};
  const occasionDateDetails: Array<{
    occasionId: string;
    occasionName: string;
    date: string;
    month: number;
    day: number;
  }> = [];

  for (const entry of contact.occasionDates ?? []) {
    const formatted = formatOccasionDate(entry.date);
    occasionDates[entry.occasionId] = formatted;
    occasionDateDetails.push({
      occasionId: entry.occasionId,
      occasionName: entry.occasion.name,
      date: formatted,
      month: entry.month,
      day: entry.day,
    });
  }

  return {
    id: contact.id,
    name: contact.name,
    mobile: contact.mobile,
    email: contact.email,
    occasionDates,
    occasionDateDetails,
    categoryId: contact.categoryId,
    category: contact.category
      ? { id: contact.category.id, name: contact.category.name }
      : null,
    categoryName: contact.category?.name ?? null,
    address: contact.address,
    note: contact.note,
    attributes:
      contact.attributes &&
      typeof contact.attributes === "object" &&
      !Array.isArray(contact.attributes)
        ? contact.attributes
        : {},
    isActive: contact.isActive,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

export type SerializedContact = ReturnType<typeof serializeContact>;

export function buildContactListWhere(
  organizationId: string,
  query: {
    search?: string;
    isActive: "true" | "false" | "all";
    categoryId?: string;
    occasionId?: string;
  },
): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = { organizationId };

  if (query.isActive === "true") {
    where.isActive = true;
  } else if (query.isActive === "false") {
    where.isActive = false;
  }

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.occasionId) {
    where.occasionDates = { some: { occasionId: query.occasionId } };
  }

  if (query.search) {
    const term = query.search.trim();
    if (term) {
      const digits = term.replace(/\D/g, "");
      const clauses: Prisma.ContactWhereInput[] = [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ];
      // Mobiles are stored as 10 digits; match on digits when the user typed any.
      if (digits.length > 0) {
        clauses.push({ mobile: { contains: digits } });
      }
      where.OR = clauses;
    }
  }

  return where;
}
