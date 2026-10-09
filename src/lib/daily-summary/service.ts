import { Channel, QueueStatus, UserRole } from "@prisma/client";

import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";
import { normalizeMobile } from "@/lib/contacts/mobile";
import { prisma } from "@/lib/db";
import { createMetaWhatsAppProvider } from "@/lib/messaging/providers/whatsapp/meta-whatsapp-provider";
import type { MessageProvider } from "@/lib/messaging/providers/types";
import {
  getOrganizationLocalIsoDate,
  getPreviousIsoDate,
  parseTargetDate,
} from "@/lib/queue/dates";

import { loadDailySummaryConfig, type DailySummaryConfig } from "./platform-config";

export const DAILY_SUMMARY_MAX_RECIPIENTS = 5;

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
  | { status: "not_configured" | "before_send_time" }
  | {
      status: "ran";
      targetDate: string;
      organizations: number;
      sent: number;
      failed: number;
      skipped: number;
    };

/**
 * Sends each organization yesterday's (IST) message summary once the send
 * hour has passed, including for days with nothing sent. Safe to call every minute:
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

  if (currentIstHour(now) < config.sendHour) {
    return { status: "before_send_time" };
  }

  const targetIso = getPreviousIsoDate(
    getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE, now),
  );
  const targetDate = parseTargetDate(targetIso).date;
  const notYetHandled = {
    OR: [
      { dailySummaryLastSentFor: null },
      { dailySummaryLastSentFor: { lt: targetDate } },
    ],
  };

  const organizations = await prisma.organization.findMany({
    where: { isActive: true, ...notYetHandled },
    select: {
      id: true,
      name: true,
      dailySummaryEnabled: true,
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
    targetDate: targetIso,
    organizations: organizations.length,
    sent: 0,
    failed: 0,
    skipped: 0,
  };
  if (organizations.length === 0) {
    return result;
  }

  const grouped = await prisma.sendQueue.groupBy({
    by: ["organizationId", "channel", "status"],
    where: {
      organizationId: { in: organizations.map((organization) => organization.id) },
      scheduledDate: targetDate,
      status: {
        in: [QueueStatus.SENT, QueueStatus.DELIVERED, QueueStatus.FAILED],
      },
    },
    _count: { _all: true },
  });

  const provider = summaryProvider(config);

  const countsByOrganization = new Map<string, ChannelCounts>();
  for (const row of grouped) {
    const counts = countsByOrganization.get(row.organizationId) ?? emptyCounts();
    counts[row.channel][row.status === QueueStatus.FAILED ? "failed" : "sent"] +=
      row._count._all;
    countsByOrganization.set(row.organizationId, counts);
  }

  for (const organization of organizations) {
    const claimed = await prisma.organization.updateMany({
      where: { id: organization.id, ...notYetHandled },
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

    if (!organization.dailySummaryEnabled || recipients.length === 0) {
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
  /** Numbers the Owner chose; empty means "use defaultNumber". */
  recipients: string[];
  /** The Owner's own WhatsApp number, used when no recipients are saved. */
  defaultNumber: string | null;
  maxRecipients: number;
};

export async function getDailySummarySettings(
  organizationId: string,
): Promise<DailySummarySettings> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      dailySummaryEnabled: true,
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
    recipients: organization.dailySummaryRecipients.map(
      (recipient) => recipient.mobile,
    ),
    defaultNumber: owner?.whatsappNumber ?? owner?.mobile ?? null,
    maxRecipients: DAILY_SUMMARY_MAX_RECIPIENTS,
  };
}

export async function updateDailySummarySettings(
  organizationId: string,
  input: { enabled: boolean; recipients: string[] },
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
      data: { dailySummaryEnabled: input.enabled },
    }),
  ]);

  return getDailySummarySettings(organizationId);
}
