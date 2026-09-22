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

/**
 * Structured instead of pre-formatted English strings, so the UI layer can
 * translate each reason (see getAdminHealthDict) instead of being stuck
 * with whatever language this function was written in.
 */
export type HealthReason =
  | { code: "CLIENT_INACTIVE" }
  | { code: "NO_ROUTES_ENABLED" }
  | { code: "ROUTES_NEED_SETUP" }
  | { code: "SOME_ROUTES_NEED_SETUP" }
  | { code: "QUEUE_FAILED_ITEMS"; count: number }
  | { code: "LOW_SUCCESS_RATE" }
  | { code: "NO_ISSUES" }
  | { code: "QUEUED_ITEMS_NO_ISSUES"; count: number };

export type OrganizationHealth = {
  label: OrganizationHealthLabel;
  reasons: HealthReason[];
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
  /**
   * Only FAILED queue rows that have exhausted retries or hit a
   * non-retryable error - not messages the worker will still retry on its
   * own, which don't need admin attention and shouldn't flag NEEDS_ATTENTION.
   */
  queueFailedStuckCount: number;
}): OrganizationHealth {
  if (!input.isActive) {
    return {
      label: "INACTIVE",
      reasons: [{ code: "CLIENT_INACTIVE" }],
    };
  }

  const reasons: HealthReason[] = [];
  if (input.executableRouteCount === 0) {
    reasons.push({
      code: input.enabledRouteCount > 0 ? "ROUTES_NEED_SETUP" : "NO_ROUTES_ENABLED",
    });
  } else if (input.executableRouteCount < input.enabledRouteCount) {
    reasons.push({ code: "SOME_ROUTES_NEED_SETUP" });
  }

  if (input.queueFailedStuckCount > 0) {
    reasons.push({ code: "QUEUE_FAILED_ITEMS", count: input.queueFailedStuckCount });
  }

  const decided = input.monthlySuccessCount + input.monthlyFailureCount;
  if (
    input.monthlyFailureCount > 0 &&
    decided > 0 &&
    input.monthlySuccessCount / decided < 0.9
  ) {
    reasons.push({ code: "LOW_SUCCESS_RATE" });
  }

  if (reasons.length > 0) {
    return { label: "NEEDS_ATTENTION", reasons };
  }

  return {
    label: "HEALTHY",
    reasons: [
      input.queuePendingCount > 0
        ? { code: "QUEUED_ITEMS_NO_ISSUES", count: input.queuePendingCount }
        : { code: "NO_ISSUES" },
    ],
  };
}
