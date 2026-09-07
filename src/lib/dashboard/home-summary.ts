import { Channel, QueueStatus, UserRole } from "@prisma/client";

import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";
import {
  formatAutomationSendTimeLabel,
  getLocalHourMinute,
} from "@/lib/automation/send-time";
import { getSmsChannelConfig } from "@/lib/channel-config/service";
import { getWhatsAppChannelConfig } from "@/lib/channel-config/whatsapp-service";
import { prisma } from "@/lib/db";
import {
  getOrganizationLocalIsoDate,
  getPreviousIsoDate,
  parseTargetDate,
} from "@/lib/queue/dates";
import { getOccasionsDayView } from "@/lib/queue/occasions-day-view";

export type DashboardHomeAlert = {
  message: string;
  href: string;
  cta: string;
  /** Presentation hint: failed sends read as danger, everything else as warning. */
  tone: "warning" | "danger";
};

export type RunningAutomationRow = {
  key: string;
  occasionLabel: string;
  categoryName: string;
  channelLabel: string;
  sendTimeLabel: string;
};

export type DashboardChannelStatus = {
  whatsappConnected: boolean;
  smsConnected: boolean;
};

export type UpcomingTodayItem = {
  id: string;
  timeLabel: string;
  occasionLabel: string;
  contactName: string;
  channel: Channel;
  channelLabel: string;
  status: "PENDING" | "SENDING";
};

export type DashboardUpcomingToday = {
  items: UpcomingTodayItem[];
  totalCount: number;
  viewAllHref: string;
};

export type DashboardHomeSummary = {
  todayDateLabel: string;
  automation: {
    running: boolean;
    nextRunLabel: string | null;
  };
  scheduledTodayCount: number;
  activeContactsCount: number;
  /** Owner-only: STAFF cannot view or manage channel connections. */
  channels: DashboardChannelStatus | null;
  alerts: DashboardHomeAlert[];
  runningAutomations: RunningAutomationRow[];
  missedQueue: { targetDate: string; missedCount: number } | null;
  upcomingToday: DashboardUpcomingToday;
};

export type DashboardHomeStatus = Pick<DashboardHomeSummary, "upcomingToday">;

const UPCOMING_TODAY_PREVIEW_LIMIT = 5;
/**
 * Defensive ceiling on rows fetched for today's pending/sending queue -
 * "today" already bounds this to a single calendar day, this just guards
 * against an unexpectedly large single-day batch. The exact total (for
 * "more than N" detection) comes from a separate count(), unaffected by
 * this cap.
 */
const UPCOMING_TODAY_SCAN_LIMIT = 200;

const CHANNEL_LABEL: Record<Channel, string> = {
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
};

/** Long-form hero date, e.g. "Tuesday, 4 August 2026" (IST calendar day). */
function formatHeroDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Clock time of the soonest upcoming daily run across active automations (today or tomorrow). */
function computeNextRunLabel(
  sendTimes: Array<{ sendHour: number; sendMinute: number }>,
  referenceDate: Date,
): string | null {
  if (sendTimes.length === 0) {
    return null;
  }

  const now = getLocalHourMinute(AUTOMATION_TIMEZONE, referenceDate);
  const nowMinutes = now.hour * 60 + now.minute;

  let best = sendTimes[0]!;
  let bestDelta = Infinity;

  for (const time of sendTimes) {
    const minutesOfDay = time.sendHour * 60 + time.sendMinute;
    const delta =
      minutesOfDay >= nowMinutes
        ? minutesOfDay - nowMinutes
        : minutesOfDay + 24 * 60 - nowMinutes;
    if (delta < bestDelta) {
      bestDelta = delta;
      best = time;
    }
  }

  return formatAutomationSendTimeLabel(best.sendHour, best.sendMinute);
}

/** Active per-category-channel automation rows, used for the status card and the running list. */
async function loadAutomationState(organizationId: string): Promise<{
  rows: RunningAutomationRow[];
  nextRunLabel: string | null;
}> {
  const rules = await prisma.categoryAutomationRule.findMany({
    where: {
      organizationId,
      sendHour: { not: null },
      sendMinute: { not: null },
    },
    include: {
      category: { select: { name: true } },
      occasion: { select: { name: true } },
    },
    orderBy: [
      { occasion: { name: "asc" } },
      { sendHour: "asc" },
      { sendMinute: "asc" },
    ],
  });

  const rows: RunningAutomationRow[] = [];
  const sendTimes: Array<{ sendHour: number; sendMinute: number }> = [];

  for (const rule of rules) {
    if (rule.sendHour === null || rule.sendMinute === null) {
      continue;
    }
    const sendTimeLabel = formatAutomationSendTimeLabel(
      rule.sendHour,
      rule.sendMinute,
    );
    const channels: Array<[boolean, string | null, Channel]> = [
      [rule.smsEnabled, rule.smsTemplateId, Channel.SMS],
      [rule.whatsappEnabled, rule.whatsappTemplateId, Channel.WHATSAPP],
      [rule.emailEnabled, rule.emailTemplateId, Channel.EMAIL],
    ];

    let ruleHasActiveChannel = false;
    for (const [enabled, templateId, channel] of channels) {
      if (!enabled || !templateId) {
        continue;
      }
      ruleHasActiveChannel = true;
      rows.push({
        key: `${rule.id}:${channel}`,
        occasionLabel: rule.occasion.name,
        categoryName: rule.category?.name ?? "All contacts",
        channelLabel: CHANNEL_LABEL[channel],
        sendTimeLabel,
      });
    }
    if (ruleHasActiveChannel) {
      sendTimes.push({ sendHour: rule.sendHour, sendMinute: rule.sendMinute });
    }
  }

  return {
    rows,
    nextRunLabel: computeNextRunLabel(sendTimes, new Date()),
  };
}

/** Category-rule send time for a queue row, keyed by occasion + contact category + channel ("" = the categoryId=null "all contacts" rule). */
function ruleTimeKey(
  occasionId: string,
  categoryId: string | null,
  channel: Channel,
): string {
  return `${occasionId}|${categoryId ?? ""}|${channel}`;
}

/**
 * Real, already-queued SendQueue rows scheduled for today (PENDING/SENDING
 * only) - never a projection of contacts who merely have an occasion today.
 * Chronological order comes from the row's category automation rule
 * (send-time is configured per rule, not per row); rows with no matching
 * rule (e.g. manual sends) fall back to their own nextAttemptAt/createdAt.
 */
async function loadUpcomingToday(
  organizationId: string,
  todayDate: string,
  todayDateFilter: Date,
): Promise<DashboardUpcomingToday> {
  const viewAllHref = `/dashboard/activity?status=pending&date=${todayDate}`;

  const [rules, totalCount, rows] = await Promise.all([
    prisma.categoryAutomationRule.findMany({
      where: {
        organizationId,
        sendHour: { not: null },
        sendMinute: { not: null },
      },
      select: {
        occasionId: true,
        categoryId: true,
        sendHour: true,
        sendMinute: true,
        smsEnabled: true,
        whatsappEnabled: true,
        emailEnabled: true,
      },
    }),
    prisma.sendQueue.count({
      where: {
        organizationId,
        status: { in: [QueueStatus.PENDING, QueueStatus.SENDING] },
        scheduledDate: todayDateFilter,
      },
    }),
    prisma.sendQueue.findMany({
      where: {
        organizationId,
        status: { in: [QueueStatus.PENDING, QueueStatus.SENDING] },
        scheduledDate: todayDateFilter,
      },
      select: {
        id: true,
        channel: true,
        status: true,
        occasionId: true,
        createdAt: true,
        nextAttemptAt: true,
        recipientName: true,
        contact: { select: { name: true, categoryId: true } },
        occasion: { select: { name: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: UPCOMING_TODAY_SCAN_LIMIT,
    }),
  ]);

  const ruleTimeByKey = new Map<string, { sendHour: number; sendMinute: number }>();
  for (const rule of rules) {
    if (rule.sendHour === null || rule.sendMinute === null) {
      continue;
    }
    const time = { sendHour: rule.sendHour, sendMinute: rule.sendMinute };
    const channels: Array<[boolean, Channel]> = [
      [rule.smsEnabled, Channel.SMS],
      [rule.whatsappEnabled, Channel.WHATSAPP],
      [rule.emailEnabled, Channel.EMAIL],
    ];
    for (const [enabled, channel] of channels) {
      if (enabled) {
        ruleTimeByKey.set(ruleTimeKey(rule.occasionId, rule.categoryId, channel), time);
      }
    }
  }

  const resolved = rows.map((row) => {
    const key = ruleTimeKey(row.occasionId, row.contact?.categoryId ?? null, row.channel);
    const fallbackKey = ruleTimeKey(row.occasionId, null, row.channel);
    const rule = ruleTimeByKey.get(key) ?? ruleTimeByKey.get(fallbackKey);

    let sendHour: number;
    let sendMinute: number;
    if (rule) {
      sendHour = rule.sendHour;
      sendMinute = rule.sendMinute;
    } else {
      const local = getLocalHourMinute(AUTOMATION_TIMEZONE, row.nextAttemptAt ?? row.createdAt);
      sendHour = local.hour;
      sendMinute = local.minute;
    }

    return {
      item: {
        id: row.id,
        timeLabel: formatAutomationSendTimeLabel(sendHour, sendMinute),
        occasionLabel: row.occasion.name,
        contactName: row.contact?.name ?? row.recipientName,
        channel: row.channel,
        channelLabel: CHANNEL_LABEL[row.channel],
        status: row.status === QueueStatus.SENDING ? "SENDING" as const : "PENDING" as const,
      },
      sortMinutes: sendHour * 60 + sendMinute,
    };
  });

  resolved.sort((a, b) => {
    if (a.sortMinutes !== b.sortMinutes) {
      return a.sortMinutes - b.sortMinutes;
    }
    return a.item.contactName.localeCompare(b.item.contactName);
  });

  return {
    items: resolved.slice(0, UPCOMING_TODAY_PREVIEW_LIMIT).map(({ item }) => item),
    totalCount,
    viewAllHref,
  };
}

/**
 * People whose automated greeting for yesterday (IST) never queued, even though
 * a channel was enabled for them - signals the daily cron missed a run.
 */
async function countMissedYesterday(
  organizationId: string,
  yesterdayIsoDate: string,
): Promise<number> {
  const view = await getOccasionsDayView(organizationId, yesterdayIsoDate);
  let missed = 0;

  for (const section of view.sections) {
    for (const contact of section.contacts) {
      const smsMissed =
        contact.smsAutomationEnabled &&
        contact.deliveryStatus === "not_scheduled";
      const whatsappMissed =
        contact.whatsappAutomationEnabled &&
        contact.whatsappDeliveryStatus === "not_scheduled";
      const emailMissed =
        contact.emailAutomationEnabled &&
        contact.emailDeliveryStatus === "not_scheduled";
      if (smsMissed || whatsappMissed || emailMissed) {
        missed += 1;
      }
    }
  }

  return missed;
}

export async function getDashboardHomeSummary(
  organizationId: string,
  role: UserRole,
): Promise<DashboardHomeSummary> {
  const isAdmin = role === UserRole.ADMIN;
  const todayDate = getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE);
  const yesterdayDate = getPreviousIsoDate(todayDate);
  const todayDateFilter = parseTargetDate(todayDate).date;

  const [
    automationState,
    occasionsToday,
    activeContactsCount,
    failedTodayCount,
    smsChannel,
    whatsappChannel,
    missedCount,
    upcomingToday,
  ] = await Promise.all([
    loadAutomationState(organizationId),
    getOccasionsDayView(organizationId, todayDate),
    prisma.contact.count({ where: { organizationId, isActive: true } }),
    prisma.sendQueue.count({
      where: {
        organizationId,
        status: QueueStatus.FAILED,
        scheduledDate: todayDateFilter,
      },
    }),
    isAdmin ? getSmsChannelConfig(organizationId) : Promise.resolve(null),
    isAdmin
      ? getWhatsAppChannelConfig(organizationId)
      : Promise.resolve(null),
    isAdmin ? countMissedYesterday(organizationId, yesterdayDate) : Promise.resolve(0),
    loadUpcomingToday(organizationId, todayDate, todayDateFilter),
  ]);

  const { rows: runningAutomations, nextRunLabel } = automationState;

  const smsConnected = Boolean(smsChannel?.configured && smsChannel.isActive);
  const whatsappConnected = Boolean(
    whatsappChannel?.configured && whatsappChannel.isActive,
  );

  const alerts: DashboardHomeAlert[] = [];

  if (isAdmin && runningAutomations.length === 0) {
    alerts.push({
      message: "Automation is paused - no active automations are configured.",
      href: "/dashboard/settings/greeting-routes",
      cta: "Configure",
      tone: "warning",
    });
  }

  if (isAdmin && !smsConnected) {
    alerts.push({
      message: "SMS provider not configured.",
      href: "/dashboard/settings/channels",
      cta: "Configure",
      tone: "warning",
    });
  }

  if (isAdmin && !whatsappConnected) {
    alerts.push({
      message: "WhatsApp is not connected.",
      href: "/dashboard/settings/channels",
      cta: "Configure",
      tone: "warning",
    });
  }

  if (failedTodayCount > 0) {
    alerts.push({
      message:
        failedTodayCount === 1
          ? "1 failed greeting today."
          : `${failedTodayCount} failed greetings today.`,
      href: "/dashboard/activity?tab=failed",
      cta: "Review failed",
      tone: "danger",
    });
  }

  if (
    isAdmin &&
    occasionsToday.summary.total > 0 &&
    !occasionsToday.sections.some(
      (section) =>
        section.automationEnabled || section.whatsappAutomationEnabled,
    )
  ) {
    alerts.push({
      message: `${occasionsToday.summary.total} ${
        occasionsToday.summary.total === 1 ? "person has" : "people have"
      } an occasion today, but greeting routes are off.`,
      href: "/dashboard/settings/greeting-routes",
      cta: "Set up automatic greetings",
      tone: "warning",
    });
  }

  return {
    todayDateLabel: formatHeroDateLabel(todayDate),
    automation: {
      running: runningAutomations.length > 0,
      nextRunLabel,
    },
    scheduledTodayCount: occasionsToday.summary.total,
    activeContactsCount,
    channels: isAdmin ? { whatsappConnected, smsConnected } : null,
    alerts,
    runningAutomations,
    missedQueue:
      isAdmin && missedCount > 0
        ? { targetDate: yesterdayDate, missedCount }
        : null,
    upcomingToday,
  };
}

/** Small polling payload for live queue changes on the dashboard. */
export async function getDashboardHomeStatus(
  organizationId: string,
): Promise<DashboardHomeStatus> {
  const todayDate = getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE);
  const todayDateFilter = parseTargetDate(todayDate).date;

  return {
    upcomingToday: await loadUpcomingToday(
      organizationId,
      todayDate,
      todayDateFilter,
    ),
  };
}
