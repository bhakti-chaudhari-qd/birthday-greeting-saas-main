import type {
  Contact,
  ContactCategoryDefinition,
  ContactOccasionDate,
  Occasion,
  Prisma,
} from "@prisma/client";

import { formatOccasionDate } from "@/lib/contacts/dates";
import { maskEmailForDisplay, maskMobileForDisplay } from "@/lib/contacts/mask";

type ContactWithCategory = Contact & {
  category?: Pick<ContactCategoryDefinition, "id" | "name"> | null;
  categoryTags?: Array<{
    category: Pick<ContactCategoryDefinition, "id" | "name">;
  }>;
  occasionDates?: Array<
    Pick<ContactOccasionDate, "occasionId" | "date" | "month" | "day"> & {
      occasion: Pick<Occasion, "id" | "name">;
    }
  >;
};

/**
 * `maskAdminAdded: true` hides the real mobile/email of a contact a
 * Platform Admin added on the client's behalf (Contact.addedByPlatformAdmin)
 * behind a display mask - used for Staff viewers; the org Owner always sees
 * the real values. The mask clears once the client edits and saves the
 * contact (see updateContact).
 */
export function serializeContact(
  contact: ContactWithCategory,
  options: { maskAdminAdded?: boolean } = {},
) {
  const isMasked = options.maskAdminAdded === true && contact.addedByPlatformAdmin;
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

  const categoryTags = (contact.categoryTags ?? []).map((tag) => ({
    id: tag.category.id,
    name: tag.category.name,
  }));

  return {
    id: contact.id,
    name: contact.name,
    mobile: isMasked ? maskMobileForDisplay(contact.mobile) : contact.mobile,
    email:
      isMasked && contact.email
        ? maskEmailForDisplay(contact.email)
        : contact.email,
    mobileMasked: isMasked,
    addedByPlatformAdmin: contact.addedByPlatformAdmin,
    occasionDates,
    occasionDateDetails,
    categoryId: contact.categoryId,
    category: contact.category
      ? { id: contact.category.id, name: contact.category.name }
      : null,
    categoryName: contact.category?.name ?? null,
    /** Extra categories beyond the primary one - does not include `category`. */
    categoryTags,
    categoryTagIds: categoryTags.map((tag) => tag.id),
    /** Primary category + all tags, deduped - convenience for display/filtering. */
    allCategories: contact.category
      ? [
          { id: contact.category.id, name: contact.category.name },
          ...categoryTags.filter((tag) => tag.id !== contact.category!.id),
        ]
      : categoryTags,
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
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { categoryId: query.categoryId },
          { categoryTags: { some: { categoryId: query.categoryId } } },
        ],
      },
    ];
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
