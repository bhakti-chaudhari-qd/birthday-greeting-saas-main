import { createHash, randomBytes } from "node:crypto";

import { UserRole } from "@prisma/client";

import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";
import { normalizeMobile } from "@/lib/contacts/mobile";
import { prisma } from "@/lib/db";
import { createMetaWhatsAppProvider } from "@/lib/messaging/providers/whatsapp/meta-whatsapp-provider";
import type { MessageProvider } from "@/lib/messaging/providers/types";
import {
  formatIsoDate,
  getOccasionMatchPairs,
  getOrganizationLocalIsoDate,
  parseTargetDate,
} from "@/lib/queue/dates";

import {
  getPlatformTomorrowListSettings,
  loadTomorrowListConfig,
  type TomorrowListConfig,
} from "./platform-config";

export const TOMORROW_LIST_MAX_RECIPIENTS = 5;
/**
 * Token the Platform Admin test message links to. The page shows made-up
 * names for it, so the template's button can be checked end to end without
 * exposing any client's contacts.
 */
export const TOMORROW_LIST_SAMPLE_TOKEN = "sample";

/** Organizations handled per cron tick; the rest follow on the next ticks. */
const ORGANIZATIONS_PER_RUN = 25;
const META_REQUEST_TIMEOUT_MS = 15_000;
/** IST is a fixed UTC+5:30 offset year-round (no DST). */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
/** Expired links are kept this long (for view counts), then deleted. */
const EXPIRED_LINK_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export class TomorrowListValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TomorrowListValidationError";
  }
}

// ---------------------------------------------------------------- tokens ---

export function createTomorrowListToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashTomorrowListToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Next calendar day for an ISO date (YYYY-MM-DD), timezone-independent. */
export function getNextIsoDate(isoDate: string): string {
  const { year, month, day } = parseTargetDate(isoDate);
  const utc = new Date(Date.UTC(year, month - 1, day + 1));
  return formatIsoDate(
    utc.getUTCFullYear(),
    utc.getUTCMonth() + 1,
    utc.getUTCDate(),
  );
}

/**
 * The instant a link for `isoDate` stops working: midnight IST at the end
 * of that day, as a UTC instant.
 */
export function tomorrowListExpiresAt(isoDate: string): Date {
  const { year, month, day } = parseTargetDate(isoDate);
  return new Date(Date.UTC(year, month - 1, day + 1) - IST_OFFSET_MS);
}

/** Only the last four digits ever leave the server. */
export function lastFourDigits(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  return digits.slice(-4);
}

// ------------------------------------------------------------ list data ---

export type TomorrowListSection = {
  occasionName: string;
  isSystem: boolean;
  contacts: Array<{ name: string; mobileLast4: string }>;
};

export type TomorrowListView =
  | { status: "expired" }
  | {
      status: "ok";
      organizationName: string;
      isoDate: string;
      expiresAt: string;
      total: number;
      sections: TomorrowListSection[];
    };

/**
 * Everyone with an occasion on `isoDate`, one section per occasion
 * (Birthday first, then the rest in the order they were created). Empty
 * occasions are left out. Feb 29 contacts are listed on Feb 28 in non-leap
 * years, matching the greeting automation.
 */
export async function loadTomorrowListSections(
  organizationId: string,
  isoDate: string,
): Promise<TomorrowListSection[]> {
  const target = parseTargetDate(isoDate);
  const pairs = getOccasionMatchPairs(target.month, target.day, target.year);

  const [occasions, rows] = await Promise.all([
    prisma.occasion.findMany({
      where: { organizationId },
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { id: true, name: true, isSystem: true },
    }),
    prisma.contactOccasionDate.findMany({
      where: {
        organizationId,
        OR: pairs.map((pair) => ({ month: pair.month, day: pair.day })),
        contact: { isActive: true },
      },
      select: {
        occasionId: true,
        contact: { select: { name: true, mobile: true } },
      },
    }),
  ]);

  const byOccasion = new Map<string, TomorrowListSection["contacts"]>();
  for (const row of rows) {
    const list = byOccasion.get(row.occasionId) ?? [];
    list.push({
      name: row.contact.name.trim(),
      mobileLast4: lastFourDigits(row.contact.mobile),
    });
    byOccasion.set(row.occasionId, list);
  }

  return occasions.flatMap((occasion) => {
    const contacts = byOccasion.get(occasion.id);
    if (!contacts || contacts.length === 0) {
      return [];
    }
    contacts.sort((a, b) => a.name.localeCompare(b.name));
    return [{ occasionName: occasion.name, isSystem: occasion.isSystem, contacts }];
  });
}

function sampleView(now: Date): TomorrowListView {
  const isoDate = getNextIsoDate(getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE, now));
  const sections: TomorrowListSection[] = [
    {
      occasionName: "Birthday",
      isSystem: true,
      contacts: [
        { name: "Sample Contact One", mobileLast4: "1234" },
        { name: "Sample Contact Two", mobileLast4: "5678" },
      ],
    },
    {
      occasionName: "Anniversary",
      isSystem: false,
      contacts: [{ name: "Sample Contact Three", mobileLast4: "9012" }],
    },
  ];
  return {
    status: "ok",
    organizationName: "Test Organization",
    isoDate,
    expiresAt: tomorrowListExpiresAt(isoDate).toISOString(),
    total: 3,
    sections,
  };
}

/**
 * What the public /t/[token] page shows. Unknown, expired and deactivated
 * links all read as "expired" so the page never confirms a token existed.
 * The list is built live, so contacts added after the message went out
 * still appear.
 */
export async function getTomorrowListView(
  token: string,
  now: Date = new Date(),
): Promise<TomorrowListView> {
  if (token === TOMORROW_LIST_SAMPLE_TOKEN) {
    return sampleView(now);
  }
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    return { status: "expired" };
  }

  const link = await prisma.tomorrowListLink.findUnique({
    where: { tokenHash: hashTomorrowListToken(token) },
    select: {
      id: true,
      organizationId: true,
      forDate: true,
      expiresAt: true,
      organization: { select: { name: true, isActive: true } },
    },
  });
  if (!link || link.expiresAt <= now || !link.organization.isActive) {
    return { status: "expired" };
  }

  const isoDate = link.forDate.toISOString().slice(0, 10);
  const [sections] = await Promise.all([
    loadTomorrowListSections(link.organizationId, isoDate),
    prisma.tomorrowListLink.update({
      where: { id: link.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: now },
    }),
  ]);

  return {
    status: "ok",
    organizationName: link.organization.name,
    isoDate,
    expiresAt: link.expiresAt.toISOString(),
    total: sections.reduce((sum, section) => sum + section.contacts.length, 0),
    sections,
  };
}

// ---------------------------------------------------------------- sender ---

function listProvider(config: TomorrowListConfig): MessageProvider {
  return createMetaWhatsAppProvider({
    accessToken: config.accessToken,
    phoneNumberId: config.phoneNumberId,
    apiVersion: config.apiVersion,
    requestTimeoutMs: META_REQUEST_TIMEOUT_MS,
  });
}

/**
 * Template body variables, in order: organization name, the occasion date,
 * and how many people have an occasion that day. The template's single URL
 * button ends in {{1}}, which is filled with the link token.
 */
export function buildTomorrowListParameters(
  organizationName: string,
  isoDate: string,
  total: number,
): string[] {
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseTargetDate(isoDate).date);

  return [organizationName, dateLabel, String(total)];
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

function notHandledFor(targetDate: Date) {
  return {
    OR: [
      { tomorrowListLastSentFor: null },
      { tomorrowListLastSentFor: { lt: targetDate } },
    ],
  };
}

export type TomorrowListRunResult =
  | { status: "not_configured" }
  | {
      status: "ran";
      organizations: number;
      sent: number;
      failed: number;
      skipped: number;
    };

/**
 * On the day before, once each organization's send hour (the Owner's
 * choice, else the platform default) has passed, sends a WhatsApp link to
 * the next day's list. Days with nobody on the list are marked handled but
 * not sent. Safe to call every minute: an organization is claimed for the
 * day before anything is sent, so overlapping ticks cannot send it twice.
 */
export async function runTomorrowLists(
  now: Date = new Date(),
): Promise<TomorrowListRunResult> {
  const config = await loadTomorrowListConfig();
  if (!config) {
    return { status: "not_configured" };
  }

  const nowHour = currentIstHour(now);
  const forIso = getNextIsoDate(getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE, now));
  const forDate = parseTargetDate(forIso).date;

  const organizations = await prisma.organization.findMany({
    where: {
      isActive: true,
      tomorrowListEnabled: true,
      tomorrowListAllowedByAdmin: true,
      AND: [
        notHandledFor(forDate),
        {
          OR: [
            { tomorrowListSendHour: { lte: nowHour } },
            ...(config.sendHour <= nowHour ? [{ tomorrowListSendHour: null }] : []),
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      tomorrowListRecipients: { select: { mobile: true } },
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

  await prisma.tomorrowListLink.deleteMany({
    where: { expiresAt: { lt: new Date(now.getTime() - EXPIRED_LINK_RETENTION_MS) } },
  });

  const provider = listProvider(config);
  const target = parseTargetDate(forIso);
  const pairs = getOccasionMatchPairs(target.month, target.day, target.year);

  for (const organization of organizations) {
    const claimed = await prisma.organization.updateMany({
      where: { id: organization.id, ...notHandledFor(forDate) },
      data: { tomorrowListLastSentFor: forDate },
    });
    if (claimed.count === 0) {
      continue;
    }

    const owner = organization.users[0];
    const recipients =
      organization.tomorrowListRecipients.length > 0
        ? organization.tomorrowListRecipients.map((recipient) => recipient.mobile)
        : [owner?.whatsappNumber ?? owner?.mobile].filter(
            (mobile): mobile is string => Boolean(mobile),
          );

    const total = await prisma.contactOccasionDate.count({
      where: {
        organizationId: organization.id,
        OR: pairs.map((pair) => ({ month: pair.month, day: pair.day })),
        contact: { isActive: true },
      },
    });

    if (recipients.length === 0 || total === 0) {
      result.skipped += 1;
      continue;
    }

    const token = createTomorrowListToken();
    const link = {
      tokenHash: hashTomorrowListToken(token),
      expiresAt: tomorrowListExpiresAt(forIso),
    };
    await prisma.tomorrowListLink.upsert({
      where: {
        organizationId_forDate: { organizationId: organization.id, forDate },
      },
      create: { organizationId: organization.id, forDate, ...link },
      update: { ...link, viewCount: 0, lastViewedAt: null },
    });

    const parameterValues = buildTomorrowListParameters(
      organization.name,
      forIso,
      total,
    );

    for (const recipient of recipients) {
      try {
        await provider.send({
          channel: "WHATSAPP",
          recipient,
          templateName: config.templateName,
          language: config.language,
          parameterValues,
          buttonUrlSuffix: token,
          renderedBody: parameterValues.join(" | "),
          idempotencyKey: `tomorrow-list:${organization.id}:${forIso}:${recipient}`,
          attemptNumber: 1,
        });
        result.sent += 1;
      } catch (error) {
        result.failed += 1;
        console.error("Tomorrow's List send failed", {
          organizationId: organization.id,
          forDate: forIso,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return result;
}

/**
 * Sends one message with sample numbers to `mobile`. Its button opens the
 * sample list, so a Platform Admin can check the template and its link.
 */
export async function sendTomorrowListTest(mobile: string): Promise<void> {
  const config = await loadTomorrowListConfig();
  if (!config) {
    throw new TomorrowListValidationError(
      "Save the template and switch Tomorrow's List on first",
    );
  }

  let recipient: string;
  try {
    recipient = normalizeMobile(mobile);
  } catch {
    throw new TomorrowListValidationError(
      "Enter a valid 10-digit Indian mobile number",
    );
  }

  const forIso = getNextIsoDate(getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE));
  const parameterValues = buildTomorrowListParameters("Test Organization", forIso, 3);

  await listProvider(config).send({
    channel: "WHATSAPP",
    recipient,
    templateName: config.templateName,
    language: config.language,
    parameterValues,
    buttonUrlSuffix: TOMORROW_LIST_SAMPLE_TOKEN,
    renderedBody: parameterValues.join(" | "),
    idempotencyKey: `tomorrow-list-test:${Date.now()}`,
    attemptNumber: 1,
  });
}

// -------------------------------------------------------------- settings ---

export type TomorrowListSettings = {
  enabled: boolean;
  /** False when a Platform Admin switched it off for this org. */
  allowedByAdmin: boolean;
  recipients: string[];
  defaultNumber: string | null;
  maxRecipients: number;
  /** IST hour (0-23) on the day before; null means "use defaultSendHour". */
  sendHour: number | null;
  defaultSendHour: number;
};

export async function getTomorrowListSettings(
  organizationId: string,
): Promise<TomorrowListSettings> {
  const platform = await getPlatformTomorrowListSettings();
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      tomorrowListEnabled: true,
      tomorrowListAllowedByAdmin: true,
      tomorrowListSendHour: true,
      tomorrowListRecipients: {
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
    enabled: organization.tomorrowListEnabled,
    allowedByAdmin: organization.tomorrowListAllowedByAdmin,
    recipients: organization.tomorrowListRecipients.map(
      (recipient) => recipient.mobile,
    ),
    defaultNumber: owner?.whatsappNumber ?? owner?.mobile ?? null,
    maxRecipients: TOMORROW_LIST_MAX_RECIPIENTS,
    sendHour: organization.tomorrowListSendHour,
    defaultSendHour: platform.sendHour,
  };
}

export async function updateTomorrowListSettings(
  organizationId: string,
  input: {
    enabled: boolean;
    recipients: string[];
    /** Omit to keep the saved hour; null goes back to the platform default. */
    sendHour?: number | null;
  },
): Promise<TomorrowListSettings> {
  const recipients: string[] = [];
  for (const raw of input.recipients) {
    let mobile: string;
    try {
      mobile = normalizeMobile(raw);
    } catch {
      throw new TomorrowListValidationError(
        `"${raw}" is not a valid 10-digit Indian mobile number`,
      );
    }
    if (!recipients.includes(mobile)) {
      recipients.push(mobile);
    }
  }

  if (recipients.length > TOMORROW_LIST_MAX_RECIPIENTS) {
    throw new TomorrowListValidationError(
      `You can add up to ${TOMORROW_LIST_MAX_RECIPIENTS} numbers`,
    );
  }

  await prisma.$transaction([
    prisma.tomorrowListRecipient.deleteMany({ where: { organizationId } }),
    prisma.tomorrowListRecipient.createMany({
      data: recipients.map((mobile) => ({ organizationId, mobile })),
    }),
    prisma.organization.update({
      where: { id: organizationId },
      data: {
        tomorrowListEnabled: input.enabled,
        ...(input.sendHour !== undefined
          ? { tomorrowListSendHour: input.sendHour }
          : {}),
      },
    }),
  ]);

  return getTomorrowListSettings(organizationId);
}
