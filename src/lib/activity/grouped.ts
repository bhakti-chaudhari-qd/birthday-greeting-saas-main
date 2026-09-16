import { Channel, Prisma, QueueStatus } from "@prisma/client";

import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";
import { prisma } from "@/lib/db";
import { getOrganizationLocalIsoDate, parseTargetDate } from "@/lib/queue/dates";

export type ActivityStatusFilter = "all" | "sent" | "failed" | "pending";
export type ActivityRecipientStatus = "sent" | "failed" | "pending";

export type GroupedActivityQuery = {
  /** Range start (YYYY-MM-DD, inclusive). Defaults to endDate, or today if both are unset. */
  startDate?: string;
  /** Range end (YYYY-MM-DD, inclusive). Defaults to startDate, or today if both are unset. */
  endDate?: string;
  search?: string;
  status?: ActivityStatusFilter;
  channel?: Channel;
  occasionId?: string;
  categoryId?: string;
  cursor?: string;
  limit?: number;
};

export type ActivityRecipientRow = {
  queueId: string;
  contactName: string;
  categoryName: string;
  channel: Channel;
  status: ActivityRecipientStatus;
  statusLabel: string;
  sentAt: string | null;
  failureReason: string | null;
  lastErrorCode: string | null;
  canRetry: boolean;
};

export type ActivityGroup = {
  key: string;
  title: string;
  occasionLabel: string | null;
  categoryName: string | null;
  /** Greeting day (YYYY-MM-DD) this group's queue rows were scheduled for. */
  scheduledDate: string;
  executedAtLabel: string;
  executedAt: string;
  counts: { sent: number; failed: number; pending: number; total: number };
  recipients: ActivityRecipientRow[];
};

export type GroupedActivityResult = {
  startDate: string;
  endDate: string;
  summary: { sent: number; failed: number; pending: number; total: number };
  groups: ActivityGroup[];
  pagination: { nextCursor: string | null; hasMore: boolean };
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

type ActivityCursor = { createdAt: string; id: string };

function encodeCursor(cursor: ActivityCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string | undefined): ActivityCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<ActivityCursor>;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return null;
    const createdAt = new Date(parsed.createdAt);
    return Number.isNaN(createdAt.getTime()) ? null : { createdAt: createdAt.toISOString(), id: parsed.id };
  } catch {
    return null;
  }
}

function statusBucket(status: QueueStatus): ActivityRecipientStatus {
  if (status === QueueStatus.SENT || status === QueueStatus.DELIVERED) return "sent";
  if (status === QueueStatus.FAILED || status === QueueStatus.SKIPPED) return "failed";
  return "pending";
}

function statusLabel(status: QueueStatus): string {
  switch (status) {
    case QueueStatus.PENDING:
      return "Pending";
    case QueueStatus.SENDING:
      return "Sending";
    case QueueStatus.SENT:
      return "Sent";
    case QueueStatus.DELIVERED:
      return "Delivered";
    case QueueStatus.FAILED:
      return "Failed";
    case QueueStatus.SKIPPED:
      return "Skipped";
    default:
      return status;
  }
}

function statusFilterToQueueStatuses(filter: ActivityStatusFilter): QueueStatus[] | null {
  if (filter === "sent") return [QueueStatus.SENT, QueueStatus.DELIVERED];
  if (filter === "failed") return [QueueStatus.FAILED, QueueStatus.SKIPPED];
  if (filter === "pending") return [QueueStatus.PENDING, QueueStatus.SENDING];
  return null;
}

function formatTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: AUTOMATION_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Groups a date range's SendQueue rows into "automation executions": one
 * group per (day, category, occasion) for automation-originated rows, one
 * per operation for manual sends. SendQueue has no direct category FK, so
 * category comes from the joined contact.
 */
export async function getGroupedActivity(
  organizationId: string,
  query: GroupedActivityQuery,
): Promise<GroupedActivityResult> {
  const today = getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE);
  const startDate = query.startDate?.trim() || query.endDate?.trim() || today;
  const endDate = query.endDate?.trim() || query.startDate?.trim() || today;
  const parsedStart = parseTargetDate(startDate).date;
  const parsedEnd = parseTargetDate(endDate).date;
  const scheduledDateGte = parsedStart <= parsedEnd ? parsedStart : parsedEnd;
  const scheduledDateLte = parsedStart <= parsedEnd ? parsedEnd : parsedStart;
  const statusFilter = query.status ?? "all";
  const statuses = statusFilterToQueueStatuses(statusFilter);
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const cursor = decodeCursor(query.cursor);
  const search = query.search?.trim();

  const searchFilters: Prisma.SendQueueWhereInput[] = search
    ? [
        {
          OR: [
            { contact: { name: { contains: search, mode: "insensitive" } } },
            { recipientName: { contains: search, mode: "insensitive" } },
            { recipientMobile: { contains: search } },
          ],
        },
      ]
    : [];

  const baseWhere: Prisma.SendQueueWhereInput = {
    organizationId,
    scheduledDate: { gte: scheduledDateGte, lte: scheduledDateLte },
    ...(query.channel ? { channel: query.channel } : {}),
    ...(query.occasionId ? { occasionId: query.occasionId } : {}),
    ...(query.categoryId ? { contact: { categoryId: query.categoryId } } : {}),
    ...(statuses ? { status: { in: statuses } } : {}),
    AND: searchFilters,
  };

  const cursorFilter: Prisma.SendQueueWhereInput | null = cursor
    ? {
        OR: [
          { createdAt: { gt: new Date(cursor.createdAt) } },
          {
            createdAt: new Date(cursor.createdAt),
            id: { gt: cursor.id },
          },
        ],
      }
    : null;
  const where: Prisma.SendQueueWhereInput = cursorFilter
    ? { ...baseWhere, AND: [...searchFilters, cursorFilter] }
    : baseWhere;

  const [rows, groupedStatuses] = await Promise.all([
    prisma.sendQueue.findMany({
      where,
      include: {
        contact: { select: { name: true, categoryId: true, category: { select: { name: true } } } },
        occasion: { select: { name: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
    }),
    prisma.sendQueue.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows.at(-1);
  const nextCursor = hasMore && lastRow
    ? encodeCursor({ createdAt: lastRow.createdAt.toISOString(), id: lastRow.id })
    : null;

  const summary = { sent: 0, failed: 0, pending: 0, total: 0 };
  for (const grouped of groupedStatuses) {
    const bucket = statusBucket(grouped.status);
    summary[bucket] += grouped._count._all;
    summary.total += grouped._count._all;
  }
  const groupsByKey = new Map<string, ActivityGroup>();

  for (const row of pageRows) {
    const bucket = statusBucket(row.status);
    const isManual = row.idempotencyKey.startsWith("manual-send:");
    const operationId = isManual ? row.idempotencyKey.split(":")[1] : null;
    const rowScheduledDate = row.scheduledDate.toISOString().slice(0, 10);
    const key = isManual
      ? `manual:${operationId}`
      : `${rowScheduledDate}:${row.occasionId}:${row.contact?.categoryId ?? "none"}`;

    let group = groupsByKey.get(key);
    if (!group) {
      const categoryName = row.contact?.category?.name ?? "Uncategorized";
      group = {
        key,
        title: isManual ? `Manual Send - ${formatTimeLabel(row.createdAt)}` : `${categoryName} ${row.occasion.name}`,
        occasionLabel: isManual ? null : row.occasion.name,
        categoryName: isManual ? null : categoryName,
        scheduledDate: rowScheduledDate,
        executedAtLabel: formatTimeLabel(row.createdAt),
        executedAt: row.createdAt.toISOString(),
        counts: { sent: 0, failed: 0, pending: 0, total: 0 },
        recipients: [],
      };
      groupsByKey.set(key, group);
    }

    group.counts[bucket] += 1;
    group.counts.total += 1;
    group.recipients.push({
      queueId: row.id,
      contactName: row.contact?.name ?? row.recipientName,
      categoryName: row.contact?.category?.name ?? "Uncategorized",
      channel: row.channel,
      status: bucket,
      statusLabel: statusLabel(row.status),
      sentAt: row.sentAt ? row.sentAt.toISOString() : null,
      failureReason:
        row.status === QueueStatus.FAILED
          ? (row.lastError ?? "Delivery failed")
          : row.status === QueueStatus.SKIPPED
            ? "Skipped - duplicate or limit reached"
            : null,
      lastErrorCode: row.status === QueueStatus.FAILED ? row.lastErrorCode : null,
      canRetry: row.status === QueueStatus.FAILED,
    });
  }

  const groups = [...groupsByKey.values()].sort(
    (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
  );

  return { startDate, endDate, summary, groups, pagination: { nextCursor, hasMore } };
}
