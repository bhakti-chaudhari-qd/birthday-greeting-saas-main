import { Channel, QueueStatus, UserRole } from "@prisma/client";

import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";
import { getAutomationSendInstant } from "@/lib/automation/send-time";
import { normalizeMobile } from "@/lib/contacts/mobile";
import { prisma } from "@/lib/db";
import { createMetaWhatsAppProvider } from "@/lib/messaging/providers/whatsapp/meta-whatsapp-provider";
import type { MessageProvider } from "@/lib/messaging/providers/types";
import {
  getOrganizationLocalIsoDate,
  getPreviousIsoDate,
  parseTargetDate,
} from "@/lib/queue/dates";

import {
  getPlatformDailySummarySettings,
  loadDailySummaryConfig,
  type DailySummaryConfig,
} from "./platform-config";

export const DAILY_SUMMARY_MAX_RECIPIENTS = 5;
/**
 * A summary sent at or after this IST hour covers that same day, and anything
 * sent after the summary time counts towards the next day's summary. Before
 * it, the summary covers the whole previous day.
 */
export const DAILY_SUMMARY_SAME_DAY_FROM_HOUR = 18;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Organizations handled per cron tick; the rest follow on the next ticks. */
const ORGANIZATIONS_PER_RUN = 25;
const META_REQUEST_TIMEOUT_MS = 15_000;
const SUMMARY_CHANNELS = [Channel.WHATSAPP, Channel.SMS, Channel.EMAIL] as const;

export type ChannelCounts = Record<
  (typeof SUMMARY_CHANNELS)[number],
  { sent: number; failed: number }
>;

export class DailySummaryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DailySummaryValidationError";
  }
}

function summaryProvider(config: DailySummaryConfig): MessageProvider {
  return createMetaWhatsAppProvider({
    accessToken: config.accessToken,
    phoneNumberId: config.phoneNumberId,
    apiVersion: config.apiVersion,
    requestTimeoutMs: META_REQUEST_TIMEOUT_MS,
  });
}

function emptyCounts(): ChannelCounts {
  return {
    WHATSAPP: { sent: 0, failed: 0 },
    SMS: { sent: 0, failed: 0 },
    EMAIL: { sent: 0, failed: 0 },
  };
}

/**
 * Template body variables, in order: organization name, date, then sent and
 * failed counts for WhatsApp, SMS and Email. The approved template must use
 * exactly these eight variables.
 */
export function buildDailySummaryParameters(
  organizationName: string,
  isoDate: string,
  counts: ChannelCounts,
): string[] {
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseTargetDate(isoDate).date);

  return [
    organizationName,
    dateLabel,
    ...SUMMARY_CHANNELS.flatMap((channel) => [
      String(counts[channel].sent),
      String(counts[channel].failed),
    ]),
  ];
}

function currentIstHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: AUTOMATION_TIMEZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
}

export type DailySummaryRunResult =
  | { status: "not_configured" }
  | {
      status: "ran";
      organizations: number;
      sent: number;
      failed: number;
      skipped: number;
    };

/** True when a summary sent at `sendHour` (IST) covers that same day. */
export function isSameDaySummaryHour(sendHour: number): boolean {
  return sendHour >= DAILY_SUMMARY_SAME_DAY_FROM_HOUR;
}

function notHandledFor(targetDate: Date) {
  return {
    OR: [
      { dailySummaryLastSentFor: null },
      { dailySummaryLastSentFor: { lt: targetDate } },
    ],
  };
}

/**
 * Sends each organization its message summary once its send hour (the
 * Owner's choice, else the platform default) has passed, including for days
 * with nothing sent. Before 6 PM it covers the whole previous day (IST);
 * from 6 PM on it covers the 24 hours up to the send hour, so the rest of
 * that evening goes into the next day's summary. Safe to call every minute:
 * an organization is claimed for the day before anything is sent, so
 * overlapping ticks cannot send it twice.
 */
export async function runDailySummaries(
  now: Date = new Date(),
): Promise<DailySummaryRunResult> {
  const config = await loadDailySummaryConfig();
  if (!config) {
    return { status: "not_configured" };
  }

  const nowHour = currentIstHour(now);
  const todayIso = getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE, now);
  const yesterdayIso = getPreviousIsoDate(todayIso);
  const targetIsoFor = (sendHour: number) =>
    isSameDaySummaryHour(sendHour) ? todayIso : yesterdayIso;
  const targetDateFor = (sendHour: number) =>
    parseTargetDate(targetIsoFor(sendHour)).date;

  const due = [
    {
      AND: [
        {
          dailySummarySendHour: {
            lt: DAILY_SUMMARY_SAME_DAY_FROM_HOUR,
            lte: nowHour,
          },
        },
        notHandledFor(parseTargetDate(yesterdayIso).date),
      ],
    },
    {
      AND: [
        {
          dailySummarySendHour: {
            gte: DAILY_SUMMARY_SAME_DAY_FROM_HOUR,
            lte: nowHour,
          },
        },
        notHandledFor(parseTargetDate(todayIso).date),
      ],
    },
    ...(config.sendHour <= nowHour
      ? [
          {
            AND: [
              { dailySummarySendHour: null },
              notHandledFor(targetDateFor(config.sendHour)),
            ],
          },
        ]
      : []),
  ];

  const organizations = await prisma.organization.findMany({
    where: { isActive: true, OR: due },
    select: {
      id: true,
      name: true,
      dailySummaryEnabled: true,
      dailySummaryAllowedByAdmin: true,
      dailySummarySendHour: true,
      dailySummaryRecipients: { select: { mobile: true } },
      users: {
        where: { role: UserRole.ADMIN, isActive: true },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { whatsappNumber: true, mobile: true },
      },
    },
    orderBy: { id: "asc" },
    take: ORGANIZATIONS_PER_RUN,
  });

  const result = {
    status: "ran" as const,
    organizations: organizations.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };
  if (organizations.length === 0) {
    return result;
  }

  const sendHourOf = (organization: (typeof organizations)[number]) =>
    organization.dailySummarySendHour ?? config.sendHour;

  const organizationIdsByHour = new Map<number, string[]>();
  for (const organization of organizations) {
    const hour = sendHourOf(organization);
    organizationIdsByHour.set(hour, [
      ...(organizationIdsByHour.get(hour) ?? []),
      organization.id,
    ]);
  }

  // Previous-day summaries count by greeting day; same-day ones count what
  // was sent or failed in the 24 hours up to the send hour.
  const grouped = await Promise.all(
    [...organizationIdsByHour].map(([hour, organizationIds]) => {
      const base = {
        organizationId: { in: organizationIds },
        channel: { in: [...SUMMARY_CHANNELS] },
      };
      if (!isSameDaySummaryHour(hour)) {
        return prisma.sendQueue.groupBy({
          by: ["organizationId", "channel", "status"],
          where: {
            ...base,
            scheduledDate: targetDateFor(hour),
            status: {
              in: [QueueStatus.SENT, QueueStatus.DELIVERED, QueueStatus.FAILED],
            },
          },
          _count: { _all: true },
        });
      }

      const end = getAutomationSendInstant(hour, 0, now);
      const window = { gte: new Date(end.getTime() - DAY_MS), lt: end };
      return prisma.sendQueue.groupBy({
        by: ["organizationId", "channel", "status"],
        where: {
          ...base,
          OR: [
            {
              status: { in: [QueueStatus.SENT, QueueStatus.DELIVERED] },
              sentAt: window,
            },
            { status: QueueStatus.FAILED, updatedAt: window },
          ],
        },
        _count: { _all: true },
      });
    }),
  );

  const provider = summaryProvider(config);

  const countsByOrganization = new Map<string, ChannelCounts>();
  for (const row of grouped.flat()) {
    const counts = countsByOrganization.get(row.organizationId) ?? emptyCounts();
    const channelCounts = counts[row.channel as keyof ChannelCounts];
    if (!channelCounts) {
      continue;
    }
    channelCounts[row.status === QueueStatus.FAILED ? "failed" : "sent"] +=
      row._count._all;
    countsByOrganization.set(row.organizationId, counts);
  }

  for (const organization of organizations) {
    const targetIso = targetIsoFor(sendHourOf(organization));
    const targetDate = parseTargetDate(targetIso).date;
    const claimed = await prisma.organization.updateMany({
      where: { id: organization.id, ...notHandledFor(targetDate) },
      data: { dailySummaryLastSentFor: targetDate },
    });
    if (claimed.count === 0) {
      continue;
    }

    const counts = countsByOrganization.get(organization.id) ?? emptyCounts();
    const owner = organization.users[0];
    const recipients =
      organization.dailySummaryRecipients.length > 0
        ? organization.dailySummaryRecipients.map((recipient) => recipient.mobile)
        : [owner?.whatsappNumber ?? owner?.mobile].filter(
            (mobile): mobile is string => Boolean(mobile),
          );

    if (
      !organization.dailySummaryAllowedByAdmin ||
      !organization.dailySummaryEnabled ||
      recipients.length === 0
    ) {
      result.skipped += 1;
      continue;
    }

    const parameterValues = buildDailySummaryParameters(
      organization.name,
      targetIso,
      counts,
    );

    for (const recipient of recipients) {
      try {
        await provider.send({
          channel: "WHATSAPP",
          recipient,
          templateName: config.templateName,
          language: config.language,
          parameterValues,
          renderedBody: parameterValues.join(" | "),
          idempotencyKey: `daily-summary:${organization.id}:${targetIso}:${recipient}`,
          attemptNumber: 1,
        });
        result.sent += 1;
      } catch (error) {
        result.failed += 1;
        console.error("Daily summary send failed", {
          organizationId: organization.id,
          targetDate: targetIso,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return result;
}

/**
 * Sends one summary with sample numbers to `mobile` using the saved Meta
 * account and template, so a Platform Admin can check both before 9 AM.
 * Throws the provider's own error message when Meta rejects it.
 */
export async function sendDailySummaryTest(mobile: string): Promise<void> {
  const config = await loadDailySummaryConfig();
  if (!config) {
    throw new DailySummaryValidationError(
      "Save and enable the daily summary settings first",
    );
  }

  let recipient: string;
  try {
    recipient = normalizeMobile(mobile);
  } catch {
    throw new DailySummaryValidationError(
      "Enter a valid 10-digit Indian mobile number",
    );
  }

  const targetIso = getPreviousIsoDate(
    getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE),
  );
  const parameterValues = buildDailySummaryParameters("Test Organization", targetIso, {
    WHATSAPP: { sent: 12, failed: 1 },
    SMS: { sent: 5, failed: 0 },
    EMAIL: { sent: 3, failed: 0 },
  });

  await summaryProvider(config).send({
    channel: "WHATSAPP",
    recipient,
    templateName: config.templateName,
    language: config.language,
    parameterValues,
    renderedBody: parameterValues.join(" | "),
    idempotencyKey: `daily-summary-test:${Date.now()}`,
    attemptNumber: 1,
  });
}

export type DailySummarySettings = {
  enabled: boolean;
  /** False when a Platform Admin switched the summary off for this org. */
  allowedByAdmin: boolean;
  /** Numbers the Owner chose; empty means "use defaultNumber". */
  recipients: string[];
  /** The Owner's own WhatsApp number, used when no recipients are saved. */
  defaultNumber: string | null;
  maxRecipients: number;
  /** IST hour (0-23) the Owner chose; null means "use defaultSendHour". */
  sendHour: number | null;
  /** The platform-wide hour used when the Owner has not chosen one. */
  defaultSendHour: number;
};

export async function getDailySummarySettings(
  organizationId: string,
): Promise<DailySummarySettings> {
  const platform = await getPlatformDailySummarySettings();
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      dailySummaryEnabled: true,
      dailySummaryAllowedByAdmin: true,
      dailySummarySendHour: true,
      dailySummaryRecipients: {
        select: { mobile: true },
        orderBy: { createdAt: "asc" },
      },
      users: {
        where: { role: UserRole.ADMIN, isActive: true },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { whatsappNumber: true, mobile: true },
      },
    },
  });
  const owner = organization.users[0];

  return {
    enabled: organization.dailySummaryEnabled,
    allowedByAdmin: organization.dailySummaryAllowedByAdmin,
    recipients: organization.dailySummaryRecipients.map(
      (recipient) => recipient.mobile,
    ),
    defaultNumber: owner?.whatsappNumber ?? owner?.mobile ?? null,
    maxRecipients: DAILY_SUMMARY_MAX_RECIPIENTS,
    sendHour: organization.dailySummarySendHour,
    defaultSendHour: platform.sendHour,
  };
}

export async function updateDailySummarySettings(
  organizationId: string,
  input: {
    enabled: boolean;
    recipients: string[];
    /** Omit to keep the saved hour; null goes back to the platform default. */
    sendHour?: number | null;
  },
): Promise<DailySummarySettings> {
  const recipients: string[] = [];
  for (const raw of input.recipients) {
    let mobile: string;
    try {
      mobile = normalizeMobile(raw);
    } catch {
      throw new DailySummaryValidationError(
        `"${raw}" is not a valid 10-digit Indian mobile number`,
      );
    }
    if (!recipients.includes(mobile)) {
      recipients.push(mobile);
    }
  }

  if (recipients.length > DAILY_SUMMARY_MAX_RECIPIENTS) {
    throw new DailySummaryValidationError(
      `You can add up to ${DAILY_SUMMARY_MAX_RECIPIENTS} numbers`,
    );
  }

  await prisma.$transaction([
    prisma.dailySummaryRecipient.deleteMany({ where: { organizationId } }),
    prisma.dailySummaryRecipient.createMany({
      data: recipients.map((mobile) => ({ organizationId, mobile })),
    }),
    prisma.organization.update({
      where: { id: organizationId },
      data: {
        dailySummaryEnabled: input.enabled,
        ...(input.sendHour !== undefined
          ? { dailySummarySendHour: input.sendHour }
          : {}),
      },
    }),
  ]);

  return getDailySummarySettings(organizationId);
}
