import { DeliveryStatus, QueueStatus, type Prisma } from "@prisma/client";

import { getMessageProvider, isDeliveryStatusCapable } from "@/lib/messaging/providers";
import { DeliveryStatusLookupError } from "@/lib/messaging/providers/types";
import type { ProviderDeliveryOutcome } from "@/lib/messaging/providers/types";
import type { ProviderDeliveryStatusResult } from "@/lib/messaging/providers/types";
import { prisma } from "@/lib/db";
import { getOrganizationLocalIsoDate } from "@/lib/queue/dates";

import {
  DeliveryNotFoundError,
  DeliveryRefreshError,
} from "./errors";
import { mergeDeliveryStatusMetadata } from "./provider-response";
import { serializeDeliveryLog } from "./list";

const TERMINAL_DELIVERY_STATUSES = new Set<DeliveryStatus>([
  DeliveryStatus.DELIVERED,
  DeliveryStatus.UNDELIVERED,
]);

type RefreshLog = Awaited<ReturnType<typeof loadRefreshContext>>;

function formatSubmissionDate(timestamp: Date, timezone: string): string {
  try {
    return getOrganizationLocalIsoDate(timezone, timestamp);
  } catch {
    throw new DeliveryRefreshError(
      "Organization timezone is invalid",
      "INVALID_ORGANIZATION_TIMEZONE",
    );
  }
}

function mapOutcomeToDeliveryStatus(
  outcome: ProviderDeliveryOutcome,
): DeliveryStatus | null {
  switch (outcome) {
    case "delivered":
      return DeliveryStatus.DELIVERED;
    case "undelivered":
      return DeliveryStatus.UNDELIVERED;
    default:
      return null;
  }
}

function buildRefreshResult(
  log: Parameters<typeof serializeDeliveryLog>[0],
  options: {
    result: "refreshed" | "unchanged" | "already_terminal";
    providerOutcome?: ProviderDeliveryOutcome;
    rawProviderStatus?: string;
    message?: string;
  },
) {
  return {
    deliveryLogId: log.id,
    status: log.status,
    queueStatus: log.sendQueue.status,
    result: options.result,
    providerOutcome: options.providerOutcome,
    rawProviderStatus: options.rawProviderStatus,
    message: options.message,
    delivery: serializeDeliveryLog(log),
  };
}

async function loadRefreshContext(organizationId: string, deliveryLogId: string) {
  const log = await prisma.deliveryLog.findFirst({
    where: { id: deliveryLogId, organizationId },
    include: {
      sendQueue: {
        select: {
          id: true,
          channel: true,
          status: true,
          sentAt: true,
          attemptCount: true,
          renderedBody: true,
          whatsappMediaAssetId: true,
          occasionId: true,
          recipientName: true,
          recipientMobile: true,
          contact: { select: { name: true, mobile: true } },
          template: { select: { name: true } },
          organization: { select: { timezone: true } },
        },
      },
    },
  });

  if (!log) {
    throw new DeliveryNotFoundError();
  }

  return log;
}

const refreshLogInclude = {
  sendQueue: {
    select: {
      id: true,
      channel: true,
      status: true,
      sentAt: true,
      attemptCount: true,
      renderedBody: true,
      whatsappMediaAssetId: true,
      occasionId: true,
      recipientName: true,
      recipientMobile: true,
      contact: { select: { name: true, mobile: true } },
      template: { select: { name: true } },
      organization: { select: { timezone: true } },
    },
  },
} as const;

function assertRefreshEligible(log: RefreshLog) {
  if (TERMINAL_DELIVERY_STATUSES.has(log.status)) {
    return { eligible: false as const, reason: "terminal" as const };
  }

  if (log.status !== DeliveryStatus.SENT) {
    throw new DeliveryRefreshError(
      "Only successful delivery logs can be refreshed",
      "INELIGIBLE_DELIVERY_STATUS",
    );
  }

  if (!log.providerMessageId?.trim()) {
    throw new DeliveryRefreshError(
      "Delivery log is missing a provider message ID",
      "MISSING_PROVIDER_MESSAGE_ID",
    );
  }

  const submissionTimestamp = log.sendQueue.sentAt ?? log.createdAt;

  if (!submissionTimestamp) {
    throw new DeliveryRefreshError(
      "Delivery log is missing a submission timestamp",
      "MISSING_SUBMISSION_TIMESTAMP",
    );
  }

  return {
    eligible: true as const,
    submissionTimestamp,
    providerMessageId: log.providerMessageId.trim(),
  };
}

async function handleConcurrentTerminalState(
  organizationId: string,
  deliveryLogId: string,
) {
  const current = await loadRefreshContext(organizationId, deliveryLogId);

  if (TERMINAL_DELIVERY_STATUSES.has(current.status)) {
    return buildRefreshResult(current, {
      result: "already_terminal",
      message: "Delivery status changed before refresh could be saved",
    });
  }

  throw new DeliveryRefreshError(
    "Delivery log is no longer eligible for refresh",
    "INELIGIBLE_DELIVERY_STATUS",
  );
}

async function persistMetadataRefresh(
  organizationId: string,
  deliveryLogId: string,
  mergedProviderResponse: Prisma.InputJsonValue,
  providerResult: ProviderDeliveryStatusResult,
) {
  const updated = await prisma.deliveryLog.updateMany({
    where: {
      id: deliveryLogId,
      organizationId,
      status: DeliveryStatus.SENT,
    },
    data: {
      providerResponse: mergedProviderResponse,
    },
  });

  if (updated.count === 0) {
    return handleConcurrentTerminalState(organizationId, deliveryLogId);
  }

  const refreshed = await loadRefreshContext(organizationId, deliveryLogId);

  return buildRefreshResult(refreshed, {
    result: "unchanged",
    providerOutcome: providerResult.outcome,
    rawProviderStatus: providerResult.rawProviderStatus,
    message:
      providerResult.outcome === "pending"
        ? "Provider reports delivery is still pending"
        : "Provider returned a non-terminal delivery status",
  });
}

async function persistTerminalRefresh(
  organizationId: string,
  deliveryLogId: string,
  sendQueueId: string,
  nextDeliveryStatus: DeliveryStatus,
  mergedProviderResponse: Prisma.InputJsonValue,
  providerResult: ProviderDeliveryStatusResult,
) {
  const refreshed = await prisma.$transaction(async (tx) => {
    if (nextDeliveryStatus === DeliveryStatus.DELIVERED) {
      const queue = await tx.sendQueue.findFirst({
        where: { id: sendQueueId, organizationId },
        select: { status: true },
      });

      if (!queue) {
        throw new DeliveryRefreshError("Queue item not found", "QUEUE_NOT_FOUND");
      }

      if (
        queue.status !== QueueStatus.SENT &&
        queue.status !== QueueStatus.DELIVERED
      ) {
        throw new DeliveryRefreshError(
          "Queue item is not in a refreshable state",
          "INELIGIBLE_QUEUE_STATUS",
        );
      }
    }

    const logUpdate = await tx.deliveryLog.updateMany({
      where: {
        id: deliveryLogId,
        organizationId,
        status: DeliveryStatus.SENT,
      },
      data: {
        status: nextDeliveryStatus,
        providerResponse: mergedProviderResponse,
      },
    });

    if (logUpdate.count === 0) {
      return null;
    }

    if (nextDeliveryStatus === DeliveryStatus.DELIVERED) {
      const queueUpdate = await tx.sendQueue.updateMany({
        where: {
          id: sendQueueId,
          organizationId,
          status: QueueStatus.SENT,
        },
        data: {
          status: QueueStatus.DELIVERED,
        },
      });

      if (queueUpdate.count === 0) {
        const queue = await tx.sendQueue.findFirst({
          where: { id: sendQueueId, organizationId },
          select: { status: true },
        });

        if (queue?.status !== QueueStatus.DELIVERED) {
          throw new DeliveryRefreshError(
            "Queue item could not be marked delivered",
            "QUEUE_STATE_CONFLICT",
          );
        }
      }
    }

    return tx.deliveryLog.findFirstOrThrow({
      where: { id: deliveryLogId, organizationId },
      include: refreshLogInclude,
    });
  });

  if (!refreshed) {
    return handleConcurrentTerminalState(organizationId, deliveryLogId);
  }

  return buildRefreshResult(refreshed, {
    result: "refreshed",
    providerOutcome: providerResult.outcome,
    rawProviderStatus: providerResult.rawProviderStatus,
    message:
      nextDeliveryStatus === DeliveryStatus.DELIVERED
        ? "Handset delivery confirmed"
        : "Provider reports the message was not delivered",
  });
}

export async function refreshDeliveryStatus(
  organizationId: string,
  deliveryLogId: string,
) {
  const log = await loadRefreshContext(organizationId, deliveryLogId);

  if (log.sendQueue.channel === "WHATSAPP") {
    throw new DeliveryRefreshError(
      "WhatsApp delivery status refresh is not supported",
      "UNSUPPORTED_CHANNEL",
    );
  }

  const eligibility = assertRefreshEligible(log);

  if (!eligibility.eligible) {
    return buildRefreshResult(log, {
      result: "already_terminal",
      message:
        log.status === DeliveryStatus.DELIVERED
          ? "Delivery is already confirmed"
          : "Delivery is already marked undelivered",
    });
  }

  const channelConfig = await prisma.channelConfig.findFirst({
    where: {
      organizationId,
      channel: log.sendQueue.channel,
      isActive: true,
    },
  });

  const provider = getMessageProvider(channelConfig, log.sendQueue.channel);

  if (!isDeliveryStatusCapable(provider)) {
    throw new DeliveryRefreshError(
      "Configured messaging provider does not support delivery status lookup",
      "UNSUPPORTED_PROVIDER",
    );
  }

  const submissionDate = formatSubmissionDate(
    eligibility.submissionTimestamp,
    log.sendQueue.organization.timezone,
  );

  let providerResult: ProviderDeliveryStatusResult;

  try {
    providerResult = await provider.getDeliveryStatus({
      providerMessageId: eligibility.providerMessageId,
      submissionDate,
      recipient: log.sendQueue.contact?.mobile ?? log.sendQueue.recipientMobile,
    });
  } catch (error) {
    if (error instanceof DeliveryStatusLookupError) {
      throw new DeliveryRefreshError(error.message, error.code);
    }

    throw error;
  }

  const nextDeliveryStatus = mapOutcomeToDeliveryStatus(providerResult.outcome);
  const mergedProviderResponse = mergeDeliveryStatusMetadata(
    log.providerResponse,
    {
      rawProviderStatus: providerResult.rawProviderStatus,
      outcome: providerResult.outcome,
      refreshedAt: new Date().toISOString(),
      ...(providerResult.providerMessage
        ? { providerMessage: providerResult.providerMessage }
        : {}),
    },
  );

  if (!nextDeliveryStatus) {
    return persistMetadataRefresh(
      organizationId,
      deliveryLogId,
      mergedProviderResponse,
      providerResult,
    );
  }

  return persistTerminalRefresh(
    organizationId,
    deliveryLogId,
    log.sendQueueId,
    nextDeliveryStatus,
    mergedProviderResponse,
    providerResult,
  );
}

export type DeliveryRefreshResult = Awaited<
  ReturnType<typeof refreshDeliveryStatus>
>;
