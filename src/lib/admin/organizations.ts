import {
  Channel,
  DeliveryStatus,
  QueueStatus,
} from "@prisma/client";

import {
  DELIVERY_FAILURE_STATUSES,
  DELIVERY_SUCCESS_STATUSES,
  countExecutableAutomationRoutes,
  deriveOrganizationHealth,
  type OrganizationAutomationRouteInput,
  type OrganizationHealth,
} from "@/lib/admin/organization-health";
import { prisma } from "@/lib/db";
import { RETRYABLE_ERROR_CODES } from "@/lib/queue/classify";
import { MAX_SEND_ATTEMPTS } from "@/lib/queue/constants";
import { startOfIstMonth } from "@/lib/queue/dates";

export type PlatformOrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  liveChannelsApproved: boolean;
  /** Admin-controlled ceiling: whether Staff may ever see full mobile/email of an admin-added contact. */
  staffContactVisibilityAdminAllowed: boolean;
  timezone: string;
  createdAt: string;
  userCount: number;
  contactCount: number;
  plan: string | null;
  subscriptionStatus: string | null;
  contactLimit: number | null;
  monthlyMessageLimit: number | null;
  messagesSentThisMonth: number | null;
  paidUntil: string | null;
  /** Per-channel allocation for CUSTOM plans; empty when the org uses the aggregate limit. */
  channelLimits: Array<{
    channel: Channel;
    monthlyLimit: number;
    messagesSentThisMonth: number;
  }>;
  configuredChannels: Channel[];
  categoryRuleCount: number;
  enabledAutomationRouteCount: number;
  executableAutomationRouteCount: number;
  executableAutomationRoutes: Array<{
    source: "DEFAULT" | "CATEGORY";
    occasionId: string;
    occasionName: string;
    channel: Channel;
    categoryName: string | null;
  }>;
  monthlyDeliveryCount: number;
  monthlyDeliverySuccessCount: number;
  monthlyDeliveryFailureCount: number;
  monthlyDeliverySuccessRatePercent: number | null;
  queuePendingCount: number;
  queueFailedCount: number;
  /** Of queueFailedCount, how many the worker will retry on its own. */
  queueFailedRetryableCount: number;
  /** Of queueFailedCount, how many have exhausted retries or hit a non-retryable error. */
  queueFailedStuckCount: number;
  referredVendor: { id: string; name: string } | null;
  connectedVendors: Array<{ id: string; name: string }>;
  health: OrganizationHealth;
};

async function loadOrganizationsForPlatformAdmin(
  organizationId?: string,
): Promise<PlatformOrganizationSummary[]> {
  const [organizations, deliveryCounts, queueCounts, retryableFailedCounts] =
    await Promise.all([
    prisma.organization.findMany({
      where: organizationId ? { id: organizationId } : undefined,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        subscription: { include: { channelLimits: true } },
        channelConfigs: {
          where: { isActive: true },
          select: {
            channel: true,
            vendor: { select: { id: true, name: true } },
          },
        },
        referredByVendor: { select: { id: true, name: true } },
        categoryAutomationRules: {
          select: {
            occasionId: true,
            occasion: { select: { name: true } },
            category: { select: { name: true } },
            smsEnabled: true,
            smsTemplateId: true,
            smsTemplate: { select: { isActive: true } },
            whatsappEnabled: true,
            whatsappTemplateId: true,
            whatsappTemplate: { select: { isActive: true } },
            emailEnabled: true,
            emailTemplateId: true,
            emailTemplate: { select: { isActive: true } },
          },
        },
        _count: {
          select: {
            users: true,
            contacts: true,
          },
        },
      },
    }),
    prisma.deliveryLog.groupBy({
      by: ["organizationId", "status"],
      where: {
        ...(organizationId ? { organizationId } : {}),
        createdAt: { gte: startOfIstMonth() },
      },
      _count: true,
    }),
    prisma.sendQueue.groupBy({
      by: ["organizationId", "status"],
      where: {
        ...(organizationId ? { organizationId } : {}),
        status: { in: [QueueStatus.PENDING, QueueStatus.FAILED] },
      },
      _count: true,
    }),
    prisma.sendQueue.groupBy({
      by: ["organizationId"],
      where: {
        ...(organizationId ? { organizationId } : {}),
        status: QueueStatus.FAILED,
        attemptCount: { lt: MAX_SEND_ATTEMPTS },
        OR: [
          { lastErrorCode: null },
          { lastErrorCode: { in: [...RETRYABLE_ERROR_CODES] } },
        ],
      },
      _count: true,
    }),
  ]);

  const deliveriesByOrganization = new Map<
    string,
    Array<{ status: DeliveryStatus; count: number }>
  >();
  for (const row of deliveryCounts) {
    const rows = deliveriesByOrganization.get(row.organizationId) ?? [];
    rows.push({ status: row.status, count: row._count });
    deliveriesByOrganization.set(row.organizationId, rows);
  }

  const queueByOrganization = new Map<
    string,
    Array<{ status: QueueStatus; count: number }>
  >();
  for (const row of queueCounts) {
    const rows = queueByOrganization.get(row.organizationId) ?? [];
    rows.push({ status: row.status, count: row._count });
    queueByOrganization.set(row.organizationId, rows);
  }

  const retryableFailedByOrganization = new Map<string, number>(
    retryableFailedCounts.map((row) => [row.organizationId, row._count]),
  );

  return organizations.map((organization) => {
    const configuredChannels = [
      ...new Set(organization.channelConfigs.map((config) => config.channel)),
    ].sort();
    const configuredChannelSet = new Set(configuredChannels);
    const connectedVendors = [
      ...new Map(
        organization.channelConfigs
          .filter((config) => config.vendor !== null)
          .map((config) => [
            config.vendor!.id,
            { id: config.vendor!.id, name: config.vendor!.name },
          ]),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name));
    const routes: Array<
      OrganizationAutomationRouteInput & {
        source: "DEFAULT" | "CATEGORY";
        occasionId: string;
        occasionName: string;
        categoryName: string | null;
      }
    > = organization.categoryAutomationRules.flatMap((rule) => [
      {
        source: (rule.category ? "CATEGORY" : "DEFAULT") as "DEFAULT" | "CATEGORY",
        occasionId: rule.occasionId,
        occasionName: rule.occasion.name,
        categoryName: rule.category?.name ?? null,
        channel: Channel.SMS,
        enabled: rule.smsEnabled,
        hasActiveTemplate: rule.smsTemplate?.isActive === true,
      },
      {
        source: (rule.category ? "CATEGORY" : "DEFAULT") as "DEFAULT" | "CATEGORY",
        occasionId: rule.occasionId,
        occasionName: rule.occasion.name,
        categoryName: rule.category?.name ?? null,
        channel: Channel.WHATSAPP,
        enabled: rule.whatsappEnabled,
        hasActiveTemplate: rule.whatsappTemplate?.isActive === true,
      },
      {
        source: (rule.category ? "CATEGORY" : "DEFAULT") as "DEFAULT" | "CATEGORY",
        occasionId: rule.occasionId,
        occasionName: rule.occasion.name,
        categoryName: rule.category?.name ?? null,
        channel: Channel.EMAIL,
        enabled: rule.emailEnabled,
        hasActiveTemplate: rule.emailTemplate?.isActive === true,
      },
    ]);
    const { enabledRouteCount, executableRouteCount } =
      countExecutableAutomationRoutes(routes, configuredChannelSet);
    const monthlyRows =
      deliveriesByOrganization.get(organization.id) ?? [];
    const monthlyDeliveryCount = monthlyRows.reduce(
      (total, row) => total + row.count,
      0,
    );
    const monthlyDeliverySuccessCount = monthlyRows.reduce(
      (total, row) =>
        total +
        (DELIVERY_SUCCESS_STATUSES.has(row.status) ? row.count : 0),
      0,
    );
    const monthlyDeliveryFailureCount = monthlyRows.reduce(
      (total, row) =>
        total +
        (DELIVERY_FAILURE_STATUSES.has(row.status) ? row.count : 0),
      0,
    );
    const decided =
      monthlyDeliverySuccessCount + monthlyDeliveryFailureCount;
    const organizationQueueRows =
      queueByOrganization.get(organization.id) ?? [];
    const queuePendingCount =
      organizationQueueRows.find((row) => row.status === QueueStatus.PENDING)
        ?.count ?? 0;
    const queueFailedCount =
      organizationQueueRows.find((row) => row.status === QueueStatus.FAILED)
        ?.count ?? 0;
    const queueFailedRetryableCount =
      retryableFailedByOrganization.get(organization.id) ?? 0;
    const queueFailedStuckCount = queueFailedCount - queueFailedRetryableCount;
    const health = deriveOrganizationHealth({
      isActive: organization.isActive,
      enabledRouteCount,
      executableRouteCount,
      monthlySuccessCount: monthlyDeliverySuccessCount,
      monthlyFailureCount: monthlyDeliveryFailureCount,
      queuePendingCount,
      queueFailedStuckCount,
    });

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      isActive: organization.isActive,
      liveChannelsApproved: organization.liveChannelsApproved,
      staffContactVisibilityAdminAllowed:
        organization.staffContactVisibilityAdminAllowed,
      timezone: organization.timezone,
      createdAt: organization.createdAt.toISOString(),
      userCount: organization._count.users,
      contactCount: organization._count.contacts,
      plan: organization.subscription?.plan ?? null,
      subscriptionStatus: organization.subscription?.status ?? null,
      contactLimit: organization.subscription?.contactLimit ?? null,
      monthlyMessageLimit:
        organization.subscription?.monthlyMessageLimit ?? null,
      messagesSentThisMonth:
        organization.subscription?.messagesSentThisMonth ?? null,
      paidUntil: organization.subscription?.paidUntil?.toISOString() ?? null,
      channelLimits: (organization.subscription?.channelLimits ?? []).map(
        (limit) => ({
          channel: limit.channel,
          monthlyLimit: limit.monthlyLimit,
          messagesSentThisMonth: limit.messagesSentThisMonth,
        }),
      ),
      configuredChannels,
      categoryRuleCount: organization.categoryAutomationRules.length,
      enabledAutomationRouteCount: enabledRouteCount,
      executableAutomationRouteCount: executableRouteCount,
      executableAutomationRoutes: routes
        .filter(
          (route) =>
            route.enabled &&
            route.hasActiveTemplate &&
            configuredChannelSet.has(route.channel),
        )
        .map(({ source, occasionId, occasionName, channel, categoryName }) => ({
          source,
          occasionId,
          occasionName,
          channel,
          categoryName,
        })),
      monthlyDeliveryCount,
      monthlyDeliverySuccessCount,
      monthlyDeliveryFailureCount,
      monthlyDeliverySuccessRatePercent:
        decided === 0
          ? null
          : Math.round(
              (monthlyDeliverySuccessCount / decided) * 1000,
            ) / 10,
      queuePendingCount,
      queueFailedCount,
      queueFailedRetryableCount,
      queueFailedStuckCount,
      referredVendor: organization.referredByVendor,
      connectedVendors,
      health,
    };
  });
}

export function listOrganizationsForPlatformAdmin() {
  return loadOrganizationsForPlatformAdmin();
}

export async function getOrganizationSummaryForPlatformAdmin(
  organizationId: string,
) {
  const organizations = await loadOrganizationsForPlatformAdmin(organizationId);
  return organizations[0] ?? null;
}
