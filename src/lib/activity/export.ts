import { QueueStatus } from "@prisma/client";

import { getActivityUpcoming } from "@/lib/activity/upcoming";
import { escapeCsvField } from "@/lib/contacts/csv";
import { exportDeliveriesCsv } from "@/lib/deliveries/export";
import {
  buildDeliveryListWhere,
  serializeDeliveryLog,
} from "@/lib/deliveries/list";
import { prisma } from "@/lib/db";
import { buildQueueListWhere, serializeQueueItem } from "@/lib/queue/serialize";
import {
  getCustomerDeliveryStatusLabel,
  getCustomerQueueStatusLabel,
} from "@/lib/ui/customer-labels";
import type { ExportActivityQuery } from "@/lib/validation/activity-export";

export const MAX_ACTIVITY_EXPORT_ROWS = 5000;

const UPCOMING_CSV_HEADERS = [
  "contactName",
  "contactMobile",
  "categoryName",
  "occasion",
  "channel",
  "templateName",
  "status",
  "sendTime",
  "preview",
] as const;

const FAILED_CSV_HEADERS = [
  "source",
  "contactName",
  "contactMobile",
  "templateName",
  "channel",
  "status",
  "scheduledDate",
  "error",
  "preview",
] as const;

function exportUpcomingCsv(
  items: Awaited<ReturnType<typeof getActivityUpcoming>>["items"],
): string {
  const lines = [UPCOMING_CSV_HEADERS.join(",")];
  const rows = items.slice(0, MAX_ACTIVITY_EXPORT_ROWS);

  for (const item of rows) {
    lines.push(
      [
        escapeCsvField(item.contactName),
        escapeCsvField(item.contactMobile),
        escapeCsvField(item.categoryName ?? ""),
        escapeCsvField(item.occasionLabel),
        escapeCsvField(item.channel),
        escapeCsvField(item.templateName ?? ""),
        escapeCsvField(item.statusLabel),
        escapeCsvField(item.sendTimeLabel),
        escapeCsvField(item.messagePreview ?? ""),
      ].join(","),
    );
  }

  return `${lines.join("\n")}\n`;
}

async function exportFailedCsv(
  organizationId: string,
  query: ExportActivityQuery,
): Promise<{ csv: string; total: number; truncated: boolean }> {
  const queueWhere = buildQueueListWhere(organizationId, {
    search: query.search,
    status: QueueStatus.FAILED,
    channel: query.channel,
    occasionId: query.occasionId,
    categoryId: query.categoryId,
    scheduledDate: query.date,
  });

  const deliveryWhere = buildDeliveryListWhere(organizationId, {
    search: query.search,
    channel: query.channel,
    occasionId: query.occasionId,
    categoryId: query.categoryId,
    scheduledDate: query.date,
    outcome: "not_delivered",
  });

  const [queueTotal, deliveryTotal, queueItems, deliveryLogs] =
    await prisma.$transaction([
      prisma.sendQueue.count({ where: queueWhere }),
      prisma.deliveryLog.count({ where: deliveryWhere }),
      prisma.sendQueue.findMany({
        where: queueWhere,
        include: {
          contact: { select: { id: true, name: true, mobile: true } },
          template: { select: { id: true, name: true } },
          whatsappMediaAsset: { select: { filename: true } },
        },
        orderBy: [
          { scheduledDate: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: MAX_ACTIVITY_EXPORT_ROWS,
      }),
      prisma.deliveryLog.findMany({
        where: deliveryWhere,
        include: {
          sendQueue: {
            select: {
              id: true,
              channel: true,
              status: true,
              renderedBody: true,
              whatsappMediaAssetId: true,
              occasionId: true,
              scheduledDate: true,
              recipientName: true,
              recipientMobile: true,
              contact: { select: { name: true, mobile: true } },
              template: { select: { name: true } },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: MAX_ACTIVITY_EXPORT_ROWS,
      }),
    ]);

  const lines = [FAILED_CSV_HEADERS.join(",")];
  let rowCount = 0;

  for (const item of queueItems.map(serializeQueueItem)) {
    if (rowCount >= MAX_ACTIVITY_EXPORT_ROWS) {
      break;
    }
    lines.push(
      [
        escapeCsvField("queue"),
        escapeCsvField(item.contactName),
        escapeCsvField(item.contactMobile),
        escapeCsvField(item.templateName),
        escapeCsvField(item.channel),
        escapeCsvField(getCustomerQueueStatusLabel(item.status)),
        escapeCsvField(item.scheduledDate),
        escapeCsvField(item.lastError ?? ""),
        escapeCsvField(item.renderedPreview),
      ].join(","),
    );
    rowCount += 1;
  }

  for (const log of deliveryLogs) {
    if (rowCount >= MAX_ACTIVITY_EXPORT_ROWS) {
      break;
    }
    const serialized = serializeDeliveryLog(log);
    const scheduledDate = log.sendQueue.scheduledDate
      ? log.sendQueue.scheduledDate.toISOString().slice(0, 10)
      : (query.date ?? "");
    lines.push(
      [
        escapeCsvField("delivery"),
        escapeCsvField(serialized.contactName),
        escapeCsvField(serialized.contactMobile),
        escapeCsvField(serialized.templateName),
        escapeCsvField(serialized.channel),
        escapeCsvField(getCustomerDeliveryStatusLabel(serialized.status)),
        escapeCsvField(scheduledDate),
        escapeCsvField(serialized.errorMessage ?? ""),
        escapeCsvField(serialized.renderedPreview),
      ].join(","),
    );
    rowCount += 1;
  }

  const total = queueTotal + deliveryTotal;
  return {
    csv: `${lines.join("\n")}\n`,
    total,
    truncated: total > rowCount,
  };
}

export async function exportActivityCsv(
  organizationId: string,
  query: ExportActivityQuery,
): Promise<{ csv: string; total: number; truncated: boolean; filename: string }> {
  if (query.tab === "sent") {
    const result = await exportDeliveriesCsv(organizationId, {
      search: query.search,
      channel: query.channel,
      occasionId: query.occasionId,
      categoryId: query.categoryId,
      scheduledDate: query.date,
      outcome: "sent",
    });
    return {
      ...result,
      filename: "activity-submitted.csv",
    };
  }

  if (query.tab === "failed") {
    const result = await exportFailedCsv(organizationId, query);
    return {
      ...result,
      filename: "activity-failed.csv",
    };
  }

  const upcoming = await getActivityUpcoming(organizationId, {
    search: query.search,
    channel: query.channel ?? "",
    occasionId: query.occasionId ?? "",
    categoryId: query.categoryId,
    date: query.date,
  });

  return {
    csv: exportUpcomingCsv(upcoming.items),
    total: upcoming.meta.total,
    truncated: upcoming.items.length > MAX_ACTIVITY_EXPORT_ROWS,
    filename: "activity-upcoming.csv",
  };
}
