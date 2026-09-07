import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

import { ContactLimitError } from "./errors";

export async function assertContactLimitAvailable(
  organizationId: string,
  tx: Prisma.TransactionClient = prisma,
) {
  const subscription = await tx.subscription.findUnique({
    where: { organizationId },
  });

  if (!subscription) {
    throw new ContactLimitError("Subscription not found for organization");
  }

  const activeCount = await tx.contact.count({
    where: { organizationId, isActive: true },
  });

  if (activeCount >= subscription.contactLimit) {
    throw new ContactLimitError(
      `Contact limit reached (${subscription.contactLimit})`,
    );
  }

  return subscription;
}

/**
 * Limit enforcement uses a transaction-scoped count check.
 * Concurrent creates may briefly exceed the limit under heavy parallel load.
 */
export async function createContactWithinLimit<T>(
  organizationId: string,
  createFn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await assertContactLimitAvailable(organizationId, tx);
    return createFn(tx);
  });
}
