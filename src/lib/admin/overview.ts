import { prisma } from "@/lib/db";

export type PlatformOverviewStats = {
  organizationCount: number;
  activeOrganizationCount: number;
  inactiveOrganizationCount: number;
  userCount: number;
  contactCount: number;
  messagesSentThisMonth: number;
  planBreakdown: Array<{ plan: string; count: number }>;
};

export async function getPlatformOverviewStats(): Promise<PlatformOverviewStats> {
  const [organizations, userCount, contactCount, subscriptions] =
    await Promise.all([
      prisma.organization.findMany({
        select: { isActive: true },
      }),
      prisma.user.count(),
      prisma.contact.count(),
      prisma.subscription.findMany({
        select: {
          plan: true,
          messagesSentThisMonth: true,
        },
      }),
    ]);

  const organizationCount = organizations.length;
  const activeOrganizationCount = organizations.filter((o) => o.isActive).length;
  const planCounts = new Map<string, number>();
  let messagesSentThisMonth = 0;

  for (const subscription of subscriptions) {
    messagesSentThisMonth += subscription.messagesSentThisMonth;
    planCounts.set(
      subscription.plan,
      (planCounts.get(subscription.plan) ?? 0) + 1,
    );
  }

  const planBreakdown = [...planCounts.entries()]
    .map(([plan, count]) => ({ plan, count }))
    .sort((a, b) => a.plan.localeCompare(b.plan));

  return {
    organizationCount,
    activeOrganizationCount,
    inactiveOrganizationCount: organizationCount - activeOrganizationCount,
    userCount,
    contactCount,
    messagesSentThisMonth,
    planBreakdown,
  };
}
