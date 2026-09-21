import type { Prisma } from "@prisma/client";

type PrincipalMobileDb = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "user" | "vendorUser" | "vendor"
>;

/**
 * Serializes principal creation for one normalized 10-digit mobile for the
 * duration of the caller's transaction, then checks every table that holds a
 * login mobile (organization users, vendor users, and vendors' registered
 * mobiles). Pass `ignoreVendorId` when a vendor is registering with its own
 * invited number.
 */
export async function lockAndCheckPrincipalMobile(
  tx: PrincipalMobileDb,
  mobile: string,
  options: { ignoreVendorId?: string } = {},
): Promise<{ available: boolean }> {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`mobile:${mobile}`}, 0)
    )::text AS "lock"
  `;

  const [organizationUser, vendorUser, vendor] = await Promise.all([
    tx.user.findFirst({ where: { mobile }, select: { id: true } }),
    tx.vendorUser.findFirst({ where: { mobile }, select: { id: true } }),
    tx.vendor.findFirst({
      where: {
        mobile,
        ...(options.ignoreVendorId
          ? { id: { not: options.ignoreVendorId } }
          : {}),
      },
      select: { id: true },
    }),
  ]);

  return { available: !organizationUser && !vendorUser && !vendor };
}
