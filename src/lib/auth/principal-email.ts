import type { Prisma } from "@prisma/client";

type PrincipalEmailDb = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "user" | "platformAdmin" | "vendorUser"
>;

export function normalizePrincipalEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Serializes principal creation for one normalized email for the duration of
 * the caller's transaction, then checks every login principal table.
 */
export async function lockAndCheckPrincipalEmail(
  tx: PrincipalEmailDb,
  email: string,
): Promise<{ normalizedEmail: string; available: boolean }> {
  const normalizedEmail = normalizePrincipalEmail(email);

  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${normalizedEmail}, 0)
    )::text AS "lock"
  `;

  const [organizationUser, platformAdmin, vendorUser] = await Promise.all([
    tx.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true },
    }),
    tx.platformAdmin.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true },
    }),
    tx.vendorUser.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true },
    }),
  ]);

  return {
    normalizedEmail,
    available: !organizationUser && !platformAdmin && !vendorUser,
  };
}
