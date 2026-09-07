import { prisma } from "@/lib/db";

import { ensureSystemBirthdayOccasion, OccasionValidationError } from "./service";

export type OccasionOption = {
  id: string;
  name: string;
  isSystem: boolean;
};

/** Lightweight occasion list for dropdowns/filters, Birthday first. */
export async function listOccasionOptions(
  organizationId: string,
): Promise<OccasionOption[]> {
  await ensureSystemBirthdayOccasion(organizationId);

  const occasions = await prisma.occasion.findMany({
    where: { organizationId },
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { id: true, name: true, isSystem: true },
  });

  return occasions;
}

/** Confirms an occasionId belongs to the organization; throws otherwise. */
export async function resolveOccasionId(
  organizationId: string,
  occasionId: string,
): Promise<string> {
  const occasion = await prisma.occasion.findFirst({
    where: { id: occasionId, organizationId },
    select: { id: true },
  });

  if (!occasion) {
    throw new OccasionValidationError("Selected occasion was not found");
  }

  return occasion.id;
}
