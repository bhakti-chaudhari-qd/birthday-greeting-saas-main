import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export class ContactCategoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactCategoryValidationError";
  }
}

export class ContactCategoryNotFoundError extends Error {
  constructor() {
    super("Category not found");
    this.name = "ContactCategoryNotFoundError";
  }
}

export class ContactCategoryConflictError extends Error {
  constructor(message = "A category with this name already exists") {
    super(message);
    this.name = "ContactCategoryConflictError";
  }
}

export const DEFAULT_CONTACT_CATEGORY_NAMES = [
  "VVIP",
  "VIP",
  "Relative",
  "Friend",
] as const;

export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function serializeContactCategory(category: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { contacts: number };
}) {
  return {
    id: category.id,
    name: category.name,
    contactCount: category._count?.contacts ?? undefined,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export async function ensureDefaultContactCategories(
  organizationId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  for (const name of DEFAULT_CONTACT_CATEGORY_NAMES) {
    const existing = await tx.contactCategoryDefinition.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (!existing) {
      await tx.contactCategoryDefinition.create({
        data: { organizationId, name },
      });
    }
  }
}

export async function listContactCategories(organizationId: string) {
  const categories = await prisma.contactCategoryDefinition.findMany({
    where: { organizationId },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    include: { _count: { select: { contacts: true } } },
  });

  return categories.map(serializeContactCategory);
}

export async function createContactCategory(
  organizationId: string,
  nameInput: string,
) {
  const name = normalizeCategoryName(nameInput);
  if (!name) {
    throw new ContactCategoryValidationError("Category name is required");
  }
  if (name.length > 50) {
    throw new ContactCategoryValidationError(
      "Category name must be 50 characters or fewer",
    );
  }

  const existing = await prisma.contactCategoryDefinition.findFirst({
    where: {
      organizationId,
      name: { equals: name, mode: "insensitive" },
    },
  });

  if (existing) {
    throw new ContactCategoryConflictError();
  }

  try {
    const created = await prisma.contactCategoryDefinition.create({
      data: { organizationId, name },
      include: { _count: { select: { contacts: true } } },
    });
    return serializeContactCategory(created);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ContactCategoryConflictError();
    }
    throw error;
  }
}

export async function updateContactCategory(
  organizationId: string,
  categoryId: string,
  nameInput: string,
) {
  const name = normalizeCategoryName(nameInput);
  if (!name) {
    throw new ContactCategoryValidationError("Category name is required");
  }
  if (name.length > 50) {
    throw new ContactCategoryValidationError(
      "Category name must be 50 characters or fewer",
    );
  }

  const current = await prisma.contactCategoryDefinition.findFirst({
    where: { id: categoryId, organizationId },
  });
  if (!current) {
    throw new ContactCategoryNotFoundError();
  }

  const duplicate = await prisma.contactCategoryDefinition.findFirst({
    where: {
      organizationId,
      name: { equals: name, mode: "insensitive" },
      NOT: { id: categoryId },
    },
  });
  if (duplicate) {
    throw new ContactCategoryConflictError();
  }

  try {
    const updated = await prisma.contactCategoryDefinition.update({
      where: { id: categoryId },
      data: { name },
      include: { _count: { select: { contacts: true } } },
    });
    return serializeContactCategory(updated);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ContactCategoryConflictError();
    }
    throw error;
  }
}

export async function deleteContactCategory(
  organizationId: string,
  categoryId: string,
) {
  const existing = await prisma.contactCategoryDefinition.findFirst({
    where: { id: categoryId, organizationId },
    select: { id: true },
  });
  if (!existing) {
    throw new ContactCategoryNotFoundError();
  }

  await prisma.contactCategoryDefinition.delete({ where: { id: categoryId } });
}

/**
 * Resolve a category by id (must belong to org) or by name (find or create).
 * Pass categoryId: null / categoryName: null to clear.
 */
export async function resolveContactCategoryId(
  organizationId: string,
  input: {
    categoryId?: string | null;
    categoryName?: string | null;
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string | null | undefined> {
  if (input.categoryId === null || input.categoryName === null) {
    return null;
  }

  if (input.categoryId !== undefined) {
    if (!input.categoryId) {
      return null;
    }
    const found = await tx.contactCategoryDefinition.findFirst({
      where: { id: input.categoryId, organizationId },
      select: { id: true },
    });
    if (!found) {
      throw new ContactCategoryValidationError("Selected category was not found");
    }
    return found.id;
  }

  if (input.categoryName !== undefined) {
    const name = normalizeCategoryName(input.categoryName ?? "");
    if (!name) {
      return null;
    }
    if (name.length > 50) {
      throw new ContactCategoryValidationError(
        "Category name must be 50 characters or fewer",
      );
    }

    const existing = await tx.contactCategoryDefinition.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }

    try {
      const created = await tx.contactCategoryDefinition.create({
        data: { organizationId, name },
        select: { id: true },
      });
      return created.id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await tx.contactCategoryDefinition.findFirst({
          where: {
            organizationId,
            name: { equals: name, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (raced) {
          return raced.id;
        }
      }
      throw error;
    }
  }

  return undefined;
}
