import { Channel, DeliveryStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { startOfIstDay, startOfIstMonth } from "@/lib/queue/dates";

export type VendorConnectedOrganization = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  channels: Channel[];
};

export type VendorDeliveryStatusCount = {
  status: DeliveryStatus;
  count: number;
};

export type VendorChannelCount = {
  channel: Channel;
  count: number;
};

export type VendorRecentDelivery = {
  id: string;
  organizationName: string;
  channel: Channel;
  status: DeliveryStatus;
  createdAt: string;
  errorMessage: string | null;
};

export type VendorDeliveryInsights = {
  currentActiveConnectedOrganizationCount: number;
  currentActiveConnectedOrganizations: VendorConnectedOrganization[];
  currentRoutedDeliveriesThisMonth: number;
  currentRoutedDeliveriesToday: number;
  currentRoutedSuccessCount: number;
  currentRoutedFailureCount: number;
  currentRoutedSuccessRatePercent: number | null;
  currentRoutedStatusBreakdown: VendorDeliveryStatusCount[];
  currentRoutedChannelBreakdown: VendorChannelCount[];
  currentRoutedRecentDeliveries: VendorRecentDelivery[];
};

const SUCCESS_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.SENT,
  DeliveryStatus.DELIVERED,
  DeliveryStatus.READ,
];

const FAILURE_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.FAILED,
  DeliveryStatus.UNDELIVERED,
];

export async function getVendorDeliveryInsights(
  vendorId: string,
): Promise<VendorDeliveryInsights> {
  const channelConfigs = await prisma.channelConfig.findMany({
    where: {
      vendorId,
      isActive: true,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
        },
      },
    },
    orderBy: [{ organizationId: "asc" }, { channel: "asc" }],
  });

  const orgMap = new Map<string, VendorConnectedOrganization>();
  for (const config of channelConfigs) {
    const existing = orgMap.get(config.organizationId);
    if (existing) {
      if (!existing.channels.includes(config.channel)) {
        existing.channels.push(config.channel);
      }
      continue;
    }
    orgMap.set(config.organizationId, {
      id: config.organization.id,
      name: config.organization.name,
      slug: config.organization.slug,
      isActive: config.organization.isActive,
      channels: [config.channel],
    });
  }

  const connectedOrganizations = [...orgMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  if (connectedOrganizations.length === 0) {
    return {
      currentActiveConnectedOrganizationCount: 0,
      currentActiveConnectedOrganizations: [],
      currentRoutedDeliveriesThisMonth: 0,
      currentRoutedDeliveriesToday: 0,
      currentRoutedSuccessCount: 0,
      currentRoutedFailureCount: 0,
      currentRoutedSuccessRatePercent: null,
      currentRoutedStatusBreakdown: [],
      currentRoutedChannelBreakdown: [],
      currentRoutedRecentDeliveries: [],
    };
  }

  const vendorChannelFilter: Prisma.DeliveryLogWhereInput = {
    OR: channelConfigs.map((config) => ({
      organizationId: config.organizationId,
      sendQueue: { channel: config.channel },
    })),
  };

  const monthStart = startOfIstMonth();
  const dayStart = startOfIstDay();

  const [monthlyLogs, deliveriesToday, recentLogs] = await Promise.all([
    prisma.deliveryLog.findMany({
      where: {
        ...vendorChannelFilter,
        createdAt: { gte: monthStart },
      },
      select: {
        status: true,
        sendQueue: { select: { channel: true } },
      },
    }),
    prisma.deliveryLog.count({
      where: {
        ...vendorChannelFilter,
        createdAt: { gte: dayStart },
      },
    }),
    prisma.deliveryLog.findMany({
      where: vendorChannelFilter,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 12,
      include: {
        organization: { select: { name: true } },
        sendQueue: { select: { channel: true } },
      },
    }),
  ]);

  const statusCountMap = new Map<DeliveryStatus, number>();
  const channelCountMap = new Map<Channel, number>();
  let successCount = 0;
  let failureCount = 0;

  for (const log of monthlyLogs) {
    statusCountMap.set(log.status, (statusCountMap.get(log.status) ?? 0) + 1);
    channelCountMap.set(
      log.sendQueue.channel,
      (channelCountMap.get(log.sendQueue.channel) ?? 0) + 1,
    );
    if (SUCCESS_STATUSES.includes(log.status)) {
      successCount += 1;
    }
    if (FAILURE_STATUSES.includes(log.status)) {
      failureCount += 1;
    }
  }

  const decided = successCount + failureCount;
  const successRatePercent =
    decided === 0 ? null : Math.round((successCount / decided) * 1000) / 10;

  // DeliveryLog has no historical vendor attribution. Every delivery field
  // below is scoped to the vendor's current active organization/channel routes.
  return {
    currentActiveConnectedOrganizationCount: connectedOrganizations.length,
    currentActiveConnectedOrganizations: connectedOrganizations,
    currentRoutedDeliveriesThisMonth: monthlyLogs.length,
    currentRoutedDeliveriesToday: deliveriesToday,
    currentRoutedSuccessCount: successCount,
    currentRoutedFailureCount: failureCount,
    currentRoutedSuccessRatePercent: successRatePercent,
    currentRoutedStatusBreakdown: [...statusCountMap.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    currentRoutedChannelBreakdown: [...channelCountMap.entries()]
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count),
    currentRoutedRecentDeliveries: recentLogs.map((log) => ({
      id: log.id,
      organizationName: log.organization.name,
      channel: log.sendQueue.channel,
      status: log.status,
      createdAt: log.createdAt.toISOString(),
      errorMessage: log.errorMessage,
    })),
  };
}
