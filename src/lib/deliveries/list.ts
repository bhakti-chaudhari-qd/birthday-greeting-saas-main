import type { DeliveryLog, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type {
  ExportDeliveriesQuery,
  ListDeliveriesQuery,
} from "@/lib/validation/send";

function getProviderFromLog(log: DeliveryLog): string | null {
  const response = log.providerResponse;

  if (
    response &&
    typeof response === "object" &&
    !Array.isArray(response) &&
    "provider" in response &&
    typeof response.provider === "string"
  ) {
    return response.provider;
  }

  return null;
}

function getMediaFromLog(log: DeliveryLog): {
  filename: string;
  simulated: boolean;
} | null {
  const response = log.providerResponse;
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return null;
  }
  const media = "media" in response ? response.media : null;
  if (!media || typeof media !== "object" || Array.isArray(media)) {
    return null;
  }
  return "filename" in media && typeof media.filename === "string"
    ? {
        filename: media.filename,
        simulated:
          "simulated" in media && typeof media.simulated === "boolean"
            ? media.simulated
            : false,
      }
    : null;
}

export function serializeDeliveryLog(
  log: DeliveryLog & {
    sendQueue: {
      id: string;
      channel: string;
      status: string;
      renderedBody: string;
      whatsappMediaAssetId: string | null;
      occasionId: string | null;
      recipientName: string;
      recipientMobile: string;
      contact: { name: string; mobile: string } | null;
      template: { name: string };
    };
  },
) {
  const media = getMediaFromLog(log);
  return {
    id: log.id,
    sendQueueId: log.sendQueueId,
    queueStatus: log.sendQueue.status,
    contactName: log.sendQueue.contact?.name ?? log.sendQueue.recipientName,
    contactMobile: log.sendQueue.contact?.mobile ?? log.sendQueue.recipientMobile,
    templateName: log.sendQueue.template.name,
    channel: log.sendQueue.channel,
    provider: getProviderFromLog(log),
    providerMessageId: log.providerMessageId,
    status: log.status,
    attemptNumber: log.attemptNumber,
    errorMessage: log.errorMessage,
    renderedBody: log.sendQueue.renderedBody,
    renderedPreview: log.sendQueue.renderedBody.slice(0, 80),
    mediaFilename: media?.filename ?? null,
    mediaSimulated: media?.simulated ?? false,
    mediaPreviewUrl: log.sendQueue.whatsappMediaAssetId
      ? `/api/v1/whatsapp-media/${log.sendQueue.whatsappMediaAssetId}`
      : null,
    occasionId: log.sendQueue.occasionId ?? null,
    createdAt: log.createdAt.toISOString(),
  };
}

export function buildDeliveryListWhere(
  organizationId: string,
  query: (ExportDeliveriesQuery | ListDeliveriesQuery) & {
    /** Inclusive range, used instead of scheduledDate when either bound is set. */
    scheduledDateFrom?: string;
    scheduledDateTo?: string;
  },
): Prisma.DeliveryLogWhereInput {
  const where: Prisma.DeliveryLogWhereInput = { organizationId };

  if (query.status) {
    where.status = query.status;
  } else if (query.outcome === "sent") {
    where.status = { in: ["SENT", "DELIVERED", "READ"] };
  } else if (query.outcome === "not_delivered") {
    where.status = "UNDELIVERED";
  }

  if (query.sendQueueId) {
    where.sendQueueId = query.sendQueueId;
  }

  if (
    query.channel ||
    query.queueStatus ||
    query.search ||
    query.scheduledDate ||
    query.scheduledDateFrom ||
    query.scheduledDateTo ||
    query.occasionId ||
    query.categoryId
  ) {
    where.sendQueue = {
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.queueStatus ? { status: query.queueStatus } : {}),
      ...(query.occasionId ? { occasionId: query.occasionId } : {}),
      ...(query.scheduledDateFrom || query.scheduledDateTo
        ? {
            scheduledDate: {
              ...(query.scheduledDateFrom
                ? { gte: new Date(`${query.scheduledDateFrom}T00:00:00.000Z`) }
                : {}),
              ...(query.scheduledDateTo
                ? { lte: new Date(`${query.scheduledDateTo}T00:00:00.000Z`) }
                : {}),
            },
          }
        : query.scheduledDate
          ? {
              scheduledDate: new Date(`${query.scheduledDate}T00:00:00.000Z`),
            }
          : {}),
      ...(query.categoryId
        ? {
            contact: {
              categoryId: query.categoryId,
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { contact: { name: { contains: query.search, mode: "insensitive" } } },
              { contact: { mobile: { contains: query.search } } },
              { recipientName: { contains: query.search, mode: "insensitive" } },
              { recipientMobile: { contains: query.search } },
            ],
          }
        : {}),
    };
  }

  if (query.provider) {
    where.providerResponse = {
      path: ["provider"],
      equals: query.provider,
    };
  }

  return where;
}

export async function listDeliveries(
  organizationId: string,
  query: ListDeliveriesQuery,
) {
  const where = buildDeliveryListWhere(organizationId, query);

  const [total, logs] = await prisma.$transaction([
    prisma.deliveryLog.count({ where }),
    prisma.deliveryLog.findMany({
      where,
      include: {
        sendQueue: {
          select: {
            id: true,
            channel: true,
            status: true,
            renderedBody: true,
            whatsappMediaAssetId: true,
            occasionId: true,
            recipientName: true,
            recipientMobile: true,
            contact: { select: { name: true, mobile: true } },
            template: { select: { name: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    data: logs.map(serializeDeliveryLog),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}
