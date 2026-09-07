import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export class OccasionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OccasionValidationError";
  }
}

export class OccasionNotFoundError extends Error {
  constructor() {
    super("Occasion not found");
    this.name = "OccasionNotFoundError";
  }
}

export class OccasionConflictError extends Error {
  constructor(message = "An occasion with this name already exists") {
    super(message);
    this.name = "OccasionConflictError";
  }
}

/** Thrown when deleting an occasion still referenced by contacts, automations, or templates. */
export class OccasionDeleteBlockedError extends Error {
  constructor(public readonly reasons: string[]) {
    super(`Cannot delete: still used by ${reasons.join(", ")}`);
    this.name = "OccasionDeleteBlockedError";
  }
}

export const SYSTEM_BIRTHDAY_OCCASION_NAME = "Birthday";

export function normalizeOccasionName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function serializeOccasion(occasion: {
  id: string;
  name: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    contactDates: number;
    automationRules: number;
    messageTemplates: number;
  };
}) {
  return {
    id: occasion.id,
    name: occasion.name,
    isSystem: occasion.isSystem,
    contactCount: occasion._count?.contactDates ?? undefined,
    automationCount: occasion._count?.automationRules ?? undefined,
    templateCount: occasion._count?.messageTemplates ?? undefined,
    createdAt: occasion.createdAt.toISOString(),
    updatedAt: occasion.updatedAt.toISOString(),
  };
}

/** Idempotent - creates the org's permanent Birthday occasion if it doesn't exist yet. */
export async function ensureSystemBirthdayOccasion(
  organizationId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const existing = await tx.occasion.findFirst({
    where: { organizationId, isSystem: true },
  });
  if (existing) {
    return existing;
  }

  try {
    return await tx.occasion.create({
      data: {
        organizationId,
        name: SYSTEM_BIRTHDAY_OCCASION_NAME,
        isSystem: true,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await tx.occasion.findFirst({
        where: { organizationId, isSystem: true },
      });
      if (raced) {
        return raced;
      }
    }
    throw error;
  }
}

export async function listOccasions(organizationId: string) {
  await ensureSystemBirthdayOccasion(organizationId);

  const occasions = await prisma.occasion.findMany({
    where: { organizationId },
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    include: {
      _count: {
        select: {
          contactDates: true,
          automationRules: true,
          messageTemplates: true,
        },
      },
    },
  });

  return occasions.map(serializeOccasion);
}

export async function createOccasion(organizationId: string, nameInput: string) {
  const name = normalizeOccasionName(nameInput);
  if (!name) {
    throw new OccasionValidationError("Occasion name is required");
  }
  if (name.length > 50) {
    throw new OccasionValidationError(
      "Occasion name must be 50 characters or fewer",
    );
  }

  const existing = await prisma.occasion.findFirst({
    where: { organizationId, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    throw new OccasionConflictError();
  }

  try {
    const created = await prisma.occasion.create({
      data: { organizationId, name, isSystem: false },
      include: {
        _count: {
          select: {
            contactDates: true,
            automationRules: true,
            messageTemplates: true,
          },
        },
      },
    });
    return serializeOccasion(created);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new OccasionConflictError();
    }
    throw error;
  }
}

export async function updateOccasion(
  organizationId: string,
  occasionId: string,
  nameInput: string,
) {
  const name = normalizeOccasionName(nameInput);
  if (!name) {
    throw new OccasionValidationError("Occasion name is required");
  }
  if (name.length > 50) {
    throw new OccasionValidationError(
      "Occasion name must be 50 characters or fewer",
    );
  }

  const current = await prisma.occasion.findFirst({
    where: { id: occasionId, organizationId },
  });
  if (!current) {
    throw new OccasionNotFoundError();
  }

  const duplicate = await prisma.occasion.findFirst({
    where: {
      organizationId,
      name: { equals: name, mode: "insensitive" },
      NOT: { id: occasionId },
    },
  });
  if (duplicate) {
    throw new OccasionConflictError();
  }

  try {
    const updated = await prisma.occasion.update({
      where: { id: occasionId },
      data: { name },
      include: {
        _count: {
          select: {
            contactDates: true,
            automationRules: true,
            messageTemplates: true,
          },
        },
      },
    });
    return serializeOccasion(updated);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new OccasionConflictError();
    }
    throw error;
  }
}

export async function deleteOccasion(organizationId: string, occasionId: string) {
  const occasion = await prisma.occasion.findFirst({
    where: { id: occasionId, organizationId },
  });
  if (!occasion) {
    throw new OccasionNotFoundError();
  }

  if (occasion.isSystem) {
    throw new OccasionValidationError(
      `The ${occasion.name} occasion cannot be deleted`,
    );
  }

  const [contactCount, automationCount, templateCount] = await Promise.all([
    prisma.contactOccasionDate.count({ where: { occasionId } }),
    prisma.categoryAutomationRule.count({ where: { occasionId } }),
    prisma.messageTemplate.count({ where: { occasionId } }),
  ]);

  const reasons: string[] = [];
  if (contactCount > 0) reasons.push(pluralize(contactCount, "contact"));
  if (automationCount > 0)
    reasons.push(pluralize(automationCount, "automation rule"));
  if (templateCount > 0) reasons.push(pluralize(templateCount, "template"));

  if (reasons.length > 0) {
    throw new OccasionDeleteBlockedError(reasons);
  }

  await prisma.occasion.delete({ where: { id: occasionId } });
}
