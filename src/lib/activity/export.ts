import { QueueStatus } from "@prisma/client";

import { getActivityUpcoming } from "@/lib/activity/upcoming";
import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";
import { escapeCsvField } from "@/lib/contacts/csv";
import type { Locale } from "@/lib/i18n/constants";
import { getCsvHeaders } from "@/lib/i18n/dictionaries/csv-headers";
import { exportDeliveriesCsv } from "@/lib/deliveries/export";
import {
  buildDeliveryListWhere,
  serializeDeliveryLog,
} from "@/lib/deliveries/list";
import { prisma } from "@/lib/db";
import { getOrganizationLocalIsoDate, parseTargetDate } from "@/lib/queue/dates";
import { buildQueueListWhere, serializeQueueItem } from "@/lib/queue/serialize";
import {
  getCustomerDeliveryStatusLabel,
  getCustomerQueueStatusLabel,
} from "@/lib/ui/customer-labels";
import type { ExportActivityQuery } from "@/lib/validation/activity-export";

export const MAX_ACTIVITY_EXPORT_ROWS = 5000;
/** Upcoming occasions are computed per calendar day - cap the range so a wide export doesn't run away. */
const MAX_UPCOMING_EXPORT_DAYS = 31;

/** Inclusive list of YYYY-MM-DD dates from start to end, capped at MAX_UPCOMING_EXPORT_DAYS. */
function enumerateIsoDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (dates.length < MAX_UPCOMING_EXPORT_DAYS) {
    dates.push(cursor);
    if (cursor >= end) break;
    const { year, month, day } = parseTargetDate(cursor);
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  }
  return dates;
}

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
  locale: Locale,
): string {
  const labels = getCsvHeaders(locale).activityUpcoming;
  const lines = [
    UPCOMING_CSV_HEADERS.map((header) => escapeCsvField(labels[header])).join(","),
  ];
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
  locale: Locale,
): Promise<{ csv: string; total: number; truncated: boolean }> {
  const queueWhere = buildQueueListWhere(organizationId, {
    search: query.search,
    status: QueueStatus.FAILED,
    channel: query.channel,
    occasionId: query.occasionId,
    categoryId: query.categoryId,
    scheduledDateFrom: query.startDate,
    scheduledDateTo: query.endDate,
  });

  const deliveryWhere = buildDeliveryListWhere(organizationId, {
    search: query.search,
    channel: query.channel,
    occasionId: query.occasionId,
    categoryId: query.categoryId,
    scheduledDateFrom: query.startDate,
    scheduledDateTo: query.endDate,
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

  const failedLabels = getCsvHeaders(locale).activityFailed;
  const lines = [
    FAILED_CSV_HEADERS.map((header) => escapeCsvField(failedLabels[header])).join(","),
  ];
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
      : (query.startDate ?? "");
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
  locale: Locale = "en",
): Promise<{ csv: string; total: number; truncated: boolean; filename: string }> {
  if (query.tab === "sent") {
    const result = await exportDeliveriesCsv(organizationId, {
      search: query.search,
      channel: query.channel,
      occasionId: query.occasionId,
      categoryId: query.categoryId,
      scheduledDateFrom: query.startDate,
      scheduledDateTo: query.endDate,
      outcome: "sent",
    }, locale);
    return {
      ...result,
      filename: "activity-submitted.csv",
    };
  }

  if (query.tab === "failed") {
    const result = await exportFailedCsv(organizationId, query, locale);
    return {
      ...result,
      filename: "activity-failed.csv",
    };
  }

  const today = getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE);
  const rangeStart = query.startDate ?? query.endDate ?? today;
  const rangeEnd = query.endDate ?? query.startDate ?? today;
  const rangeDates = enumerateIsoDateRange(
    rangeStart <= rangeEnd ? rangeStart : rangeEnd,
    rangeStart <= rangeEnd ? rangeEnd : rangeStart,
  );
  const dayResults = await Promise.all(
    rangeDates.map((date) =>
      getActivityUpcoming(organizationId, {
        search: query.search,
        channel: query.channel ?? "",
        occasionId: query.occasionId ?? "",
        categoryId: query.categoryId,
        date,
      }),
    ),
  );
  const upcomingItems = dayResults.flatMap((result) => result.items);
  const upcomingTotal = dayResults.reduce((sum, result) => sum + result.meta.total, 0);

  return {
    csv: exportUpcomingCsv(upcomingItems, locale),
    total: upcomingTotal,
    truncated: upcomingItems.length > MAX_ACTIVITY_EXPORT_ROWS,
    filename: "activity-upcoming.csv",
  };
}
