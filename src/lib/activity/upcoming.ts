import { Channel, QueueStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  getOccasionsDayView,
  type OccasionDayContact,
  type OccasionsDayView,
} from "@/lib/queue/occasions-day-view";
import {
  overallHumanStatus,
  type OccasionHumanStatus,
} from "@/lib/queue/occasions-status";
import { previewTemplate } from "@/lib/templates/variables";
import { getOccasionStatusLabel } from "@/lib/ui/customer-labels";

const UPCOMING_STATUSES: ReadonlySet<OccasionHumanStatus> = new Set([
  "will_send",
  "pending",
  "sending",
]);

export type ActivityMessagePreviewPart = {
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  templateName: string | null;
  messageBody: string | null;
  mediaPreviewUrl: string | null;
  mediaFilename: string | null;
};

export type ActivityUpcomingItem = {
  id: string;
  source: "occasion" | "manual_queue";
  contactName: string;
  contactMobile: string;
  categoryName: string | null;
  occasionLabel: string;
  channel: "SMS" | "WHATSAPP" | "EMAIL" | "MULTI";
  templateName: string | null;
  messagePreview: string | null;
  /** Full channel payloads for the Preview dialog. */
  previewParts: ActivityMessagePreviewPart[];
  status: OccasionHumanStatus;
  statusLabel: string;
  sendTimeLabel: string;
  queueId: string | null;
  occasionId?: string | null;
};

export type ActivityUpcomingResult = {
  targetDate: string;
  sendTimeLabel: string;
  items: ActivityUpcomingItem[];
  meta: {
    total: number;
    willSend: number;
    pending: number;
    sending: number;
  };
};

function channelFilterMatches(
  channelFilter: "" | Channel,
  itemChannel: ActivityUpcomingItem["channel"],
): boolean {
  if (!channelFilter) {
    return true;
  }
  if (itemChannel === "MULTI") {
    return true;
  }
  return itemChannel === channelFilter;
}

function matchesSearch(item: ActivityUpcomingItem, search: string): boolean {
  if (!search) {
    return true;
  }
  const needle = search.toLowerCase();
  return (
    item.contactName.toLowerCase().includes(needle) ||
    item.contactMobile.toLowerCase().includes(needle) ||
    (item.categoryName?.toLowerCase().includes(needle) ?? false) ||
    (item.templateName?.toLowerCase().includes(needle) ?? false)
  );
}

function resolveItemChannel(
  smsEnabled: boolean,
  waEnabled: boolean,
  emailEnabled: boolean,
): ActivityUpcomingItem["channel"] {
  const enabledCount = [smsEnabled, waEnabled, emailEnabled].filter(Boolean).length;
  if (enabledCount > 1) {
    return "MULTI";
  }
  if (emailEnabled) {
    return "EMAIL";
  }
  if (waEnabled) {
    return "WHATSAPP";
  }
  return "SMS";
}

function buildPreviewParts(
  contact: OccasionDayContact,
  smsEnabled: boolean,
  waEnabled: boolean,
  emailEnabled: boolean,
): ActivityMessagePreviewPart[] {
  const parts: ActivityMessagePreviewPart[] = [];

  if (smsEnabled) {
    parts.push({
      channel: "SMS",
      templateName: contact.smsTemplateName,
      messageBody: contact.smsMessageBody,
      mediaPreviewUrl: null,
      mediaFilename: null,
    });
  }

  if (waEnabled) {
    parts.push({
      channel: "WHATSAPP",
      templateName: contact.whatsappTemplateName,
      messageBody: contact.whatsappMessageBody,
      mediaPreviewUrl: contact.whatsappMediaPreviewUrl,
      mediaFilename: contact.whatsappMediaFilename,
    });
  }

  if (emailEnabled) {
    parts.push({
      channel: "EMAIL",
      templateName: contact.emailTemplateName ?? null,
      messageBody: contact.emailMessageBody ?? null,
      mediaPreviewUrl: null,
      mediaFilename: null,
    });
  }

  return parts;
}

function resolveTemplateName(parts: ActivityMessagePreviewPart[]): string | null {
  const named = parts.filter((part) => part.templateName);
  if (named.length === 0) {
    return null;
  }
  if (named.length === 1) {
    return named[0]!.templateName;
  }
  return named
    .map((part) => `${part.channel === "WHATSAPP" ? "WhatsApp" : part.channel}: ${part.templateName}`)
    .join(" · ");
}

function resolveMessagePreview(
  parts: ActivityMessagePreviewPart[],
): string | null {
  for (const part of parts) {
    if (part.messageBody?.trim()) {
      return previewTemplate(part.messageBody);
    }
  }
  return null;
}

/**
 * Build Upcoming rows from today's occasions (including Will send before
 * queue generation) plus any manual-send queue work still waiting.
 */
export function buildUpcomingFromOccasionsDayView(
  view: OccasionsDayView,
): ActivityUpcomingItem[] {
  const items: ActivityUpcomingItem[] = [];

  for (const section of view.sections) {
    for (const contact of section.contacts) {
      const status = overallHumanStatus(
        contact.smsAutomationEnabled,
        contact.deliveryStatus,
        contact.whatsappAutomationEnabled,
        contact.whatsappDeliveryStatus,
        Boolean(contact.emailAutomationEnabled),
        contact.emailDeliveryStatus ?? "not_scheduled",
      );

      if (!UPCOMING_STATUSES.has(status)) {
        continue;
      }

      const smsEnabled = contact.smsAutomationEnabled;
      const waEnabled = contact.whatsappAutomationEnabled;
      const emailEnabled = Boolean(contact.emailAutomationEnabled);
      const previewParts = buildPreviewParts(
        contact,
        smsEnabled,
        waEnabled,
        emailEnabled,
      );

      items.push({
        id: `occasion:${section.occasionId}:${contact.id}`,
        source: "occasion",
        contactName: contact.name,
        contactMobile: contact.mobile,
        categoryName: contact.categoryName,
        occasionLabel: section.label,
        channel: resolveItemChannel(smsEnabled, waEnabled, emailEnabled),
        templateName: resolveTemplateName(previewParts),
        messagePreview: resolveMessagePreview(previewParts),
        previewParts,
        status,
        statusLabel: getOccasionStatusLabel(status),
        sendTimeLabel: contact.sendTimeLabel,
        queueId: null,
        occasionId: section.occasionId,
      });
    }
  }

  return items;
}

export async function getActivityUpcoming(
  organizationId: string,
  query: {
    search?: string;
    channel?: "" | Channel;
    occasionId?: string;
    categoryId?: string;
    /** Greeting day YYYY-MM-DD (IST). Defaults to today. */
    date?: string;
  } = {},
): Promise<ActivityUpcomingResult> {
  const view = await getOccasionsDayView(
    organizationId,
    query.date,
    query.categoryId,
  );
  let occasionItems = buildUpcomingFromOccasionsDayView(view);

  if (query.occasionId) {
    occasionItems = occasionItems.filter(
      (item) => item.occasionId === query.occasionId,
    );
  }

  const primarySendTimeLabel =
    view.sections.find((section) => section.sendTimeLabel !== "Send time not set")
      ?.sendTimeLabel ?? "Send time not set";

  const manualQueue = await prisma.sendQueue.findMany({
    where: {
      organizationId,
      status: { in: [QueueStatus.PENDING, QueueStatus.SENDING] },
      idempotencyKey: { startsWith: "manual-send:" },
      ...(query.date
        ? { scheduledDate: new Date(`${query.date}T00:00:00.000Z`) }
        : {}),
      ...(query.occasionId ? { occasionId: query.occasionId } : {}),
      ...(query.categoryId
        ? { contact: { categoryId: query.categoryId } }
        : {}),
    },
    include: {
      contact: {
        select: {
          name: true,
          mobile: true,
          category: { select: { name: true } },
        },
      },
      template: { select: { name: true } },
      whatsappMediaAsset: { select: { filename: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 500,
  });

  const manualItems: ActivityUpcomingItem[] = manualQueue.map((row) => {
    const status: OccasionHumanStatus =
      row.status === QueueStatus.SENDING ? "sending" : "pending";
    const channel = row.channel as "SMS" | "WHATSAPP" | "EMAIL";
    const previewParts: ActivityMessagePreviewPart[] = [
      {
        channel,
        templateName: row.template.name,
        messageBody: row.renderedBody,
        mediaPreviewUrl: row.whatsappMediaAssetId
          ? `/api/v1/whatsapp-media/${row.whatsappMediaAssetId}`
          : null,
        mediaFilename: row.whatsappMediaAsset?.filename ?? null,
      },
    ];

    return {
      id: `manual:${row.id}`,
      source: "manual_queue" as const,
      contactName: row.contact?.name ?? row.recipientName,
      contactMobile: row.contact?.mobile ?? row.recipientMobile,
      categoryName: row.contact?.category?.name ?? null,
      occasionLabel: "Send Messages",
      channel,
      templateName: row.template.name,
      messagePreview: previewTemplate(row.renderedBody),
      previewParts,
      status,
      statusLabel: getOccasionStatusLabel(status),
      sendTimeLabel: primarySendTimeLabel,
      queueId: row.id,
      occasionId: row.occasionId,
    };
  });

  const search = query.search?.trim() ?? "";
  const channelFilter = query.channel ?? "";

  const items = [...occasionItems, ...manualItems].filter(
    (item) =>
      matchesSearch(item, search) &&
      channelFilterMatches(channelFilter, item.channel),
  );

  const statusRank: Record<string, number> = {
    will_send: 0,
    pending: 1,
    sending: 2,
  };
  items.sort((a, b) => {
    const rank = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
    if (rank !== 0) {
      return rank;
    }
    return a.contactName.localeCompare(b.contactName);
  });

  return {
    targetDate: view.targetDate,
    sendTimeLabel: primarySendTimeLabel,
    items,
    meta: {
      total: items.length,
      willSend: items.filter((item) => item.status === "will_send").length,
      pending: items.filter((item) => item.status === "pending").length,
      sending: items.filter((item) => item.status === "sending").length,
    },
  };
}
