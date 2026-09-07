import { Channel, DeliveryStatus } from "@prisma/client";

export const DELIVERY_SUCCESS_STATUSES = new Set<DeliveryStatus>([
  DeliveryStatus.SENT,
  DeliveryStatus.DELIVERED,
  DeliveryStatus.READ,
]);

export const DELIVERY_FAILURE_STATUSES = new Set<DeliveryStatus>([
  DeliveryStatus.FAILED,
  DeliveryStatus.UNDELIVERED,
]);

export type OrganizationHealthLabel =
  | "HEALTHY"
  | "NEEDS_ATTENTION"
  | "INACTIVE";

export type OrganizationHealth = {
  label: OrganizationHealthLabel;
  reasons: string[];
};

export type OrganizationAutomationRouteInput = {
  channel: Channel;
  enabled: boolean;
  hasActiveTemplate: boolean;
};

export function countExecutableAutomationRoutes(
  routes: OrganizationAutomationRouteInput[],
  configuredChannels: ReadonlySet<Channel>,
) {
  const enabledRouteCount = routes.filter((route) => route.enabled).length;
  const executableRouteCount = routes.filter(
    (route) =>
      route.enabled &&
      route.hasActiveTemplate &&
      configuredChannels.has(route.channel),
  ).length;

  return { enabledRouteCount, executableRouteCount };
}

export function deriveOrganizationHealth(input: {
  isActive: boolean;
  enabledRouteCount: number;
  executableRouteCount: number;
  monthlySuccessCount: number;
  monthlyFailureCount: number;
  queuePendingCount: number;
  queueFailedCount: number;
}): OrganizationHealth {
  if (!input.isActive) {
    return {
      label: "INACTIVE",
      reasons: ["Organization is inactive"],
    };
  }

  const reasons: string[] = [];
  if (input.executableRouteCount === 0) {
    reasons.push(
      input.enabledRouteCount > 0
        ? "Enabled routes need a template or active channel"
        : "No automation routes are enabled",
    );
  } else if (input.executableRouteCount < input.enabledRouteCount) {
    reasons.push("Some enabled routes need a template or active channel");
  }

  if (input.queueFailedCount > 0) {
    reasons.push(`${input.queueFailedCount} failed queue item(s)`);
  }

  const decided = input.monthlySuccessCount + input.monthlyFailureCount;
  if (
    input.monthlyFailureCount > 0 &&
    decided > 0 &&
    input.monthlySuccessCount / decided < 0.9
  ) {
    reasons.push("Monthly delivery success is below 90%");
  }

  if (reasons.length > 0) {
    return { label: "NEEDS_ATTENTION", reasons };
  }

  return {
    label: "HEALTHY",
    reasons: [
      input.queuePendingCount > 0
        ? `${input.queuePendingCount} queued item(s); no health issues detected`
        : "No health issues detected",
    ],
  };
}

