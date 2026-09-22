import { prisma } from "@/lib/db";
import { isUsagePeriodStale } from "@/lib/queue/limits";

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
          billingPeriodStart: true,
        },
      }),
    ]);

  const organizationCount = organizations.length;
  const activeOrganizationCount = organizations.filter((o) => o.isActive).length;
  const planCounts = new Map<string, number>();
  let messagesSentThisMonth = 0;
  const now = new Date();

  for (const subscription of subscriptions) {
    // The per-client counter only resets the next time that client sends a
    // message (see lockSubscriptionForQueueGeneration) - a client that
    // hasn't sent anything since an earlier IST month still has that
    // month's stale count sitting in the column. Treat it as 0 here so this
    // platform-wide total reflects the current month, without touching the
    // real counter (which the send path resets and increments itself).
    if (!isUsagePeriodStale(subscription.billingPeriodStart, now)) {
      messagesSentThisMonth += subscription.messagesSentThisMonth;
    }
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
