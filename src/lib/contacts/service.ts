import { Prisma } from "@prisma/client";

import { parseOccasionDate } from "@/lib/contacts/dates";
import { assertContactAttributesAllowed } from "@/lib/contact-fields/service";
import { prisma } from "@/lib/db";
import type {
  BulkContactIdsInput,
  BulkUpdateContactStatusInput,
  CreateContactInput,
  ListContactsQuery,
  UpdateContactInput,
} from "@/lib/validation/contact";

import {
  ContactCategoryValidationError,
  resolveContactCategoryId,
  resolveContactCategoryTagIds,
} from "./categories";
import {
  ContactConflictError,
  ContactDeleteBlockedError,
  ContactLimitError,
  ContactNotFoundError,
  ContactValidationError,
} from "./errors";
import {
  assertContactLimitAvailable,
  createContactWithinLimit,
} from "./limits";
import { normalizeMobile } from "./mobile";
import { buildContactListWhere, serializeContact } from "./serialize";

const contactWithCategory = {
  category: { select: { id: true, name: true } },
  categoryTags: {
    include: { category: { select: { id: true, name: true } } },
  },
  occasionDates: {
    include: { occasion: { select: { id: true, name: true } } },
  },
} as const;

function normalizeOptionalText(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeAttributes(
  attributes: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> | undefined {
  if (attributes === undefined) {
    return undefined;
  }

  const normalized: Record<string, string | number | boolean> = {};
  for (const [key, rawValue] of Object.entries(attributes)) {
    if (rawValue === null || rawValue === undefined) {
      continue;
    }
    if (typeof rawValue === "string") {
      const value = rawValue.trim();
      if (value) normalized[key] = value;
      continue;
    }
    if (typeof rawValue === "number" || typeof rawValue === "boolean") {
      normalized[key] = rawValue;
    }
  }
  return normalized;
}

function mapContactInput(
  input: CreateContactInput | UpdateContactInput,
  options: { requireMobile?: boolean } = {},
) {
  let mobile: string | undefined;

  if (input.mobile !== undefined) {
    try {
      mobile = normalizeMobile(input.mobile);
    } catch (error) {
      throw new ContactValidationError(
        error instanceof Error ? error.message : "Invalid mobile number",
      );
    }
  } else if (options.requireMobile) {
    throw new ContactValidationError("Mobile is required");
  }

  return {
    mobile,
    occasionDates: input.occasionDates,
    name: input.name !== undefined ? input.name.trim() : undefined,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    categoryTagIds: input.categoryTagIds,
    address: normalizeOptionalText(input.address),
    note: normalizeOptionalText(input.note),
    attributes: normalizeAttributes(input.attributes),
    email:
      "email" in input
        ? normalizeOptionalText(input.email as string | null | undefined)
        : undefined,
    isActive: input.isActive,
  };
}

function handleContactWriteError(error: unknown): never {
  if (error instanceof ContactCategoryValidationError) {
    throw new ContactValidationError(error.message);
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = error.meta?.target;
    const fields = Array.isArray(target)
      ? target.map(String)
      : typeof target === "string"
        ? [target]
        : [];
    if (fields.some((field) => field.includes("email"))) {
      throw new ContactConflictError(
        "A contact with this email already exists",
      );
    }
    throw new ContactConflictError();
  }

  throw error;
}

/**
 * Applies a per-occasion date map to a contact: sets/updates a
 * ContactOccasionDate row for each occasionId with a non-empty value, and
 * removes it for occasionIds explicitly set to null/empty. Validates every
 * occasionId belongs to the organization first.
 */
async function applyContactOccasionDates(
  tx: Prisma.TransactionClient | typeof prisma,
  organizationId: string,
  contactId: string,
  occasionDates: Record<string, string | null> | undefined,
) {
  if (!occasionDates) {
    return;
  }

  const entries = Object.entries(occasionDates);
  if (entries.length === 0) {
    return;
  }

  const occasionIds = entries.map(([occasionId]) => occasionId);
  const validOccasions = await tx.occasion.findMany({
    where: { id: { in: occasionIds }, organizationId },
    select: { id: true },
  });
  const validOccasionIds = new Set(validOccasions.map((row) => row.id));

  for (const [occasionId, value] of entries) {
    if (!validOccasionIds.has(occasionId)) {
      throw new ContactValidationError("Selected occasion was not found");
    }

    if (!value) {
      await tx.contactOccasionDate.deleteMany({
        where: { contactId, occasionId },
      });
      continue;
    }

    let parsed;
    try {
      parsed = parseOccasionDate(value);
    } catch (error) {
      throw new ContactValidationError(
        error instanceof Error ? error.message : "Invalid occasion date",
      );
    }

    await tx.contactOccasionDate.upsert({
      where: { contactId_occasionId: { contactId, occasionId } },
      create: {
        organizationId,
        contactId,
        occasionId,
        date: parsed.date,
        month: parsed.month,
        day: parsed.day,
      },
      update: {
        date: parsed.date,
        month: parsed.month,
        day: parsed.day,
      },
    });
  }
}

/** Replaces a contact's extra category tags, excluding its primary category (already implied). */
async function applyContactCategoryTags(
  tx: Prisma.TransactionClient | typeof prisma,
  contactId: string,
  primaryCategoryId: string | null,
  tagIds: string[] | undefined,
) {
  if (tagIds === undefined) {
    return;
  }

  const filteredTagIds = tagIds.filter((id) => id !== primaryCategoryId);

  await tx.contactCategoryTag.deleteMany({
    where: { contactId, categoryId: { notIn: filteredTagIds } },
  });

  for (const categoryId of filteredTagIds) {
    await tx.contactCategoryTag.upsert({
      where: { contactId_categoryId: { contactId, categoryId } },
      create: { contactId, categoryId },
      update: {},
    });
  }
}

export async function createContact(
  organizationId: string,
  input: CreateContactInput,
) {
  const mapped = mapContactInput(input, { requireMobile: true });

  if (!mapped.name) {
    throw new ContactValidationError("Name is required");
  }

  if (!mapped.mobile) {
    throw new ContactValidationError("Mobile is required");
  }
  await assertContactAttributesAllowed(organizationId, mapped.attributes ?? {});

  let categoryId: string | null = null;
  let categoryTagIds: string[] = [];
  try {
    const resolved = await resolveContactCategoryId(organizationId, {
      categoryId: mapped.categoryId,
      categoryName: mapped.categoryName,
    });
    categoryId = resolved === undefined ? null : resolved;
    if (mapped.categoryTagIds) {
      categoryTagIds = await resolveContactCategoryTagIds(
        organizationId,
        mapped.categoryTagIds,
      );
    }
  } catch (error) {
    handleContactWriteError(error);
  }

  const data = {
    organizationId,
    name: mapped.name,
    mobile: mapped.mobile,
    email: mapped.email ?? null,
    categoryId,
    address: mapped.address ?? null,
    note: mapped.note ?? null,
    attributes: (mapped.attributes ?? {}) as Prisma.InputJsonObject,
    isActive: mapped.isActive ?? true,
  };

  try {
    if (input.isActive === false) {
      return await prisma.$transaction(async (tx) => {
        const contact = await tx.contact.create({
          data: { ...data, isActive: false },
        });
        await applyContactOccasionDates(
          tx,
          organizationId,
          contact.id,
          mapped.occasionDates,
        );
        await applyContactCategoryTags(tx, contact.id, categoryId, categoryTagIds);
        return tx.contact.findUniqueOrThrow({
          where: { id: contact.id },
          include: contactWithCategory,
        });
      });
    }

    return await createContactWithinLimit(organizationId, async (tx) => {
      const contact = await tx.contact.create({ data });
      await applyContactOccasionDates(
        tx,
        organizationId,
        contact.id,
        mapped.occasionDates,
      );
      await applyContactCategoryTags(tx, contact.id, categoryId, categoryTagIds);
      return tx.contact.findUniqueOrThrow({
        where: { id: contact.id },
        include: contactWithCategory,
      });
    });
  } catch (error) {
    handleContactWriteError(error);
  }
}

export async function listContacts(
  organizationId: string,
  query: ListContactsQuery,
) {
  const where = buildContactListWhere(organizationId, query);

  const [total, contacts] = await prisma.$transaction([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      include: contactWithCategory,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    data: contacts.map(serializeContact),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getContactById(organizationId: string, contactId: string) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId },
    include: contactWithCategory,
  });

  if (!contact) {
    throw new ContactNotFoundError();
  }

  return contact;
}

export async function updateContact(
  organizationId: string,
  contactId: string,
  input: UpdateContactInput,
) {
  const existing = await getContactById(organizationId, contactId);
  const mapped = mapContactInput(input);
  if (mapped.attributes !== undefined) {
    await assertContactAttributesAllowed(organizationId, mapped.attributes);
  }

  if (mapped.isActive === true && !existing.isActive) {
    await assertContactLimitAvailable(organizationId);
  }

  let categoryId: string | null | undefined;
  if (mapped.categoryId !== undefined || mapped.categoryName !== undefined) {
    try {
      categoryId = await resolveContactCategoryId(organizationId, {
        categoryId: mapped.categoryId,
        categoryName: mapped.categoryName,
      });
    } catch (error) {
      handleContactWriteError(error);
    }
  }

  let categoryTagIds: string[] | undefined;
  if (mapped.categoryTagIds !== undefined) {
    try {
      categoryTagIds = await resolveContactCategoryTagIds(
        organizationId,
        mapped.categoryTagIds,
      );
    } catch (error) {
      handleContactWriteError(error);
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.contact.update({
        where: { id: contactId },
        data: {
          ...(mapped.name !== undefined ? { name: mapped.name } : {}),
          ...(mapped.mobile !== undefined ? { mobile: mapped.mobile } : {}),
          ...(categoryId !== undefined ? { categoryId } : {}),
          ...(mapped.address !== undefined ? { address: mapped.address } : {}),
          ...(mapped.note !== undefined ? { note: mapped.note } : {}),
          ...(mapped.attributes !== undefined
            ? { attributes: mapped.attributes as Prisma.InputJsonObject }
            : {}),
          ...(mapped.email !== undefined ? { email: mapped.email } : {}),
          ...(mapped.isActive !== undefined ? { isActive: mapped.isActive } : {}),
        },
      });

      await applyContactOccasionDates(
        tx,
        organizationId,
        contactId,
        mapped.occasionDates,
      );

      await applyContactCategoryTags(
        tx,
        contactId,
        categoryId !== undefined ? categoryId : existing.categoryId,
        categoryTagIds,
      );

      return tx.contact.findUniqueOrThrow({
        where: { id: contactId },
        include: contactWithCategory,
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new ContactNotFoundError();
    }

    handleContactWriteError(error);
  }
}

export async function bulkUpdateContactStatus(
  organizationId: string,
  input: BulkUpdateContactStatusInput,
): Promise<{ updated: number }> {
  const uniqueIds = [...new Set(input.ids)];

  if (!input.isActive) {
    const result = await prisma.contact.updateMany({
      where: {
        organizationId,
        id: { in: uniqueIds },
        isActive: true,
      },
      data: { isActive: false },
    });
    return { updated: result.count };
  }

  return prisma.$transaction(async (tx) => {
    const inactive = await tx.contact.findMany({
      where: {
        organizationId,
        id: { in: uniqueIds },
        isActive: false,
      },
      select: { id: true },
    });

    if (inactive.length === 0) {
      return { updated: 0 };
    }

    const subscription = await tx.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      throw new ContactLimitError("Subscription not found for organization");
    }

    const activeCount = await tx.contact.count({
      where: { organizationId, isActive: true },
    });
    const remaining = subscription.contactLimit - activeCount;

    if (remaining <= 0 || inactive.length > remaining) {
      throw new ContactLimitError(
        `Cannot activate ${inactive.length} contact${
          inactive.length === 1 ? "" : "s"
        }; only ${Math.max(0, remaining)} slot${
          remaining === 1 ? "" : "s"
        } left on your plan (limit ${subscription.contactLimit}).`,
      );
    }

    const result = await tx.contact.updateMany({
      where: {
        organizationId,
        id: { in: inactive.map((row) => row.id) },
        isActive: false,
      },
      data: { isActive: true },
    });

    return { updated: result.count };
  });
}

export async function bulkDeleteContacts(
  organizationId: string,
  input: BulkContactIdsInput,
): Promise<{ deleted: number }> {
  const uniqueIds = [...new Set(input.ids)];

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.contact.findMany({
        where: { organizationId, id: { in: uniqueIds } },
        select: { id: true },
      });
      const foundIds = existing.map((row) => row.id);

      if (foundIds.length === 0) {
        return { deleted: 0 };
      }

      const queueRows = await tx.sendQueue.findMany({
        where: { organizationId, contactId: { in: foundIds } },
        select: { id: true },
      });
      const queueIds = queueRows.map((row) => row.id);

      if (queueIds.length > 0) {
        await tx.deliveryLog.deleteMany({
          where: { organizationId, sendQueueId: { in: queueIds } },
        });
        await tx.sendQueue.deleteMany({
          where: { organizationId, id: { in: queueIds } },
        });
      }

      const deleted = await tx.contact.deleteMany({
        where: { organizationId, id: { in: foundIds } },
      });

      return { deleted: deleted.count };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2014")
    ) {
      throw new ContactDeleteBlockedError();
    }
    throw error;
  }
}

/**
 * Permanently deletes a contact and related queue/delivery history for the tenant.
 * SendQueue/DeliveryLog use Restrict FKs, so related rows are removed first.
 */
export async function deleteContact(
  organizationId: string,
  contactId: string,
) {
  await getContactById(organizationId, contactId);

  try {
    await prisma.$transaction(async (tx) => {
      const queueRows = await tx.sendQueue.findMany({
        where: { organizationId, contactId },
        select: { id: true },
      });
      const queueIds = queueRows.map((row) => row.id);

      if (queueIds.length > 0) {
        await tx.deliveryLog.deleteMany({
          where: { organizationId, sendQueueId: { in: queueIds } },
        });
        await tx.sendQueue.deleteMany({
          where: { organizationId, id: { in: queueIds } },
        });
      }

      const deleted = await tx.contact.deleteMany({
        where: { id: contactId, organizationId },
      });

      if (deleted.count === 0) {
        throw new ContactNotFoundError();
      }
    });
  } catch (error) {
    if (error instanceof ContactNotFoundError) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2014")
    ) {
      throw new ContactDeleteBlockedError();
    }

    throw error;
  }
}

export { serializeContact };
