import { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";

export type VendorReferredOrganization = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  referredAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  plan: string | null;
  subscriptionStatus: string | null;
};

export async function getVendorReferredOrganizations(
  vendorId: string,
): Promise<VendorReferredOrganization[]> {
  const organizations = await prisma.organization.findMany({
    where: { referredByVendorId: vendorId },
    orderBy: [{ referredAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      referredAt: true,
      createdAt: true,
      subscription: {
        select: {
          plan: true,
          status: true,
        },
      },
      users: {
        where: { role: UserRole.ADMIN },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 1,
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return organizations.map((organization) => {
    const owner = organization.users[0] ?? null;
    const referredAt = organization.referredAt ?? organization.createdAt;

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      isActive: organization.isActive,
      referredAt: referredAt.toISOString(),
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      plan: organization.subscription?.plan ?? null,
      subscriptionStatus: organization.subscription?.status ?? null,
    };
  });
}

export async function getVendorReferralCode(
  vendorId: string,
): Promise<string | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { referralCode: true },
  });
  return vendor?.referralCode ?? null;
}
