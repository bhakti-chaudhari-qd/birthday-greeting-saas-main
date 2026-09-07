import {
  Channel,
  type Contact,
  type MessageTemplate,
  type QueueStatus,
} from "@prisma/client";

import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";
import { formatAutomationSendTimeLabel } from "@/lib/automation/send-time";
import { listOccasionOptions } from "@/lib/occasions/queries";
import { prisma } from "@/lib/db";
import {
  getOccasionMatchPairs,
  getOrganizationLocalIsoDate,
  parseTargetDate,
} from "@/lib/queue/dates";
import { TemplateRenderError } from "@/lib/templates/errors";
import {
  previewTemplate,
  renderTemplate,
  templateValuesForContact,
} from "@/lib/templates/variables";

export type OccasionDeliveryStatus =
  | "not_scheduled"
  | "pending"
  | "sending"
  | "sent"
  | "failed"
  | "skipped";

export type OccasionDayContact = {
  id: string;
  name: string;
  mobile: string;
  categoryId: string | null;
  categoryName: string | null;
  /** Effective for this contact (category rule, or the "all contacts" rule). */
  smsAutomationEnabled: boolean;
  whatsappAutomationEnabled: boolean;
  emailAutomationEnabled?: boolean;
  sendTimeLabel: string;
  /** Per-contact SMS template (from the resolved rule). */
  smsTemplateName: string | null;
  messagePreview: string | null;
  /** Full SMS body for Activity Preview (not truncated). */
  smsMessageBody: string | null;
  deliveryStatus: OccasionDeliveryStatus;
  sentAt: string | null;
  failureReason: string | null;
  whatsappTemplateName: string | null;
  whatsappMessagePreview: string | null;
  /** Full WhatsApp body for Activity Preview (not truncated). */
  whatsappMessageBody: string | null;
  whatsappMediaAssetId: string | null;
  whatsappMediaFilename: string | null;
  whatsappMediaPreviewUrl: string | null;
  whatsappDeliveryStatus: OccasionDeliveryStatus;
  whatsappSentAt: string | null;
  whatsappFailureReason: string | null;
  emailTemplateName?: string | null;
  emailMessagePreview?: string | null;
  /** Full Email body for Activity Preview (not truncated). */
  emailMessageBody?: string | null;
  emailDeliveryStatus?: OccasionDeliveryStatus;
  emailSentAt?: string | null;
  emailFailureReason?: string | null;
};

export type OccasionDaySection = {
  occasionId: string;
  occasionName: string;
  label: string;
  count: number;
  automationEnabled: boolean;
  whatsappAutomationEnabled: boolean;
  emailAutomationEnabled: boolean;
  sendTimeLabel: string;
  contacts: OccasionDayContact[];
};

export type OccasionsDayView = {
  targetDate: string;
  timezone: typeof AUTOMATION_TIMEZONE;
  summary: {
    byOccasion: Record<string, number>;
    total: number;
  };
  sections: OccasionDaySection[];
};

function hasSmsDestination(contact: Pick<Contact, "mobile" | "name">): boolean {
  return contact.mobile.trim().length > 0 && contact.name.trim().length > 0;
}

function hasEmailDestination(
  contact: Pick<Contact, "email" | "name">,
): boolean {
  return Boolean(contact.email?.trim()) && contact.name.trim().length > 0;
}

function mapQueueStatus(status: QueueStatus): OccasionDeliveryStatus {
  switch (status) {
    case "PENDING":
      return "pending";
    case "SENDING":
      return "sending";
    case "SENT":
    case "DELIVERED":
      return "sent";
    case "FAILED":
      return "failed";
    case "SKIPPED":
      return "skipped";
    default:
      return "not_scheduled";
  }
}

function renderMessageBody(
  template: MessageTemplate | null,
  contact: {
    name: string;
    email?: string | null;
    mobile?: string | null;
    address?: string | null;
  },
  queuedBody: string | null,
): string | null {
  if (queuedBody?.trim()) {
    return queuedBody.trim();
  }

  if (!template) {
    return null;
  }

  try {
    return renderTemplate(template.body, templateValuesForContact(contact));
  } catch (error) {
    if (error instanceof TemplateRenderError) {
      return null;
    }
    throw error;
  }
}

type CategoryRuleRouting = {
  smsEnabled: boolean;
  smsTemplateId: string | null;
  whatsappEnabled: boolean;
  whatsappTemplateId: string | null;
  emailEnabled: boolean;
  emailTemplateId: string | null;
  sendHour: number | null;
  sendMinute: number | null;
};

type ContactWithCategory = Contact & {
  category: { id: string; name: string } | null;
};

async function loadContactsForOccasion(
  organizationId: string,
  occasionId: string,
  pairs: Array<{ month: number; day: number }>,
  categoryId?: string,
) {
  return prisma.contact.findMany({
    where: {
      organizationId,
      isActive: true,
      ...(categoryId ? { categoryId } : {}),
      occasionDates: {
        some: {
          occasionId,
          OR: pairs.map((pair) => ({ month: pair.month, day: pair.day })),
        },
      },
    },
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

function buildSectionContacts(
  contacts: ContactWithCategory[],
  rulesByCategoryId: Map<string | null, CategoryRuleRouting>,
  templateById: Map<string, MessageTemplate>,
  smsQueueByContactId: Map<
    string,
    {
      status: QueueStatus;
      renderedBody: string;
      sentAt: Date | null;
      lastError: string | null;
    }
  >,
  whatsappQueueByContactId: Map<
    string,
    {
      status: QueueStatus;
      renderedBody: string;
      whatsappMediaAssetId: string | null;
      sentAt: Date | null;
      lastError: string | null;
    }
  >,
  emailQueueByContactId: Map<
    string,
    {
      status: QueueStatus;
      renderedBody: string;
      sentAt: Date | null;
      lastError: string | null;
    }
  >,
  mediaFilenameByAssetId: Map<string, string>,
): OccasionDayContact[] {
  const rows: OccasionDayContact[] = [];

  for (const contact of contacts) {
    const queueRow = smsQueueByContactId.get(contact.id);
    const whatsappQueueRow = whatsappQueueByContactId.get(contact.id);
    const emailQueueRow = emailQueueByContactId.get(contact.id);

    // Category-specific rule wins; otherwise fall back to the "all contacts" rule.
    const rule =
      (contact.categoryId
        ? rulesByCategoryId.get(contact.categoryId)
        : undefined) ?? rulesByCategoryId.get(null);

    let smsEnabled = Boolean(rule?.smsEnabled && rule.smsTemplateId);
    let whatsappEnabled = Boolean(rule?.whatsappEnabled && rule.whatsappTemplateId);
    let emailEnabled = Boolean(rule?.emailEnabled && rule.emailTemplateId);
    const smsTemplate = rule?.smsTemplateId
      ? (templateById.get(rule.smsTemplateId) ?? null)
      : null;
    const whatsappTemplate = rule?.whatsappTemplateId
      ? (templateById.get(rule.whatsappTemplateId) ?? null)
      : null;
    const emailTemplate = rule?.emailTemplateId
      ? (templateById.get(rule.emailTemplateId) ?? null)
      : null;
    const sendTimeLabel =
      rule && rule.sendHour !== null && rule.sendMinute !== null
        ? `${formatAutomationSendTimeLabel(rule.sendHour, rule.sendMinute)} IST`
        : "Send time not set";
    // Channels only count as automatic when a send time is configured.
    if (rule && (rule.sendHour === null || rule.sendMinute === null)) {
      smsEnabled = false;
      whatsappEnabled = false;
      emailEnabled = false;
    }

    if (smsEnabled && !hasSmsDestination(contact)) {
      smsEnabled = false;
    }
    if (whatsappEnabled && !hasSmsDestination(contact)) {
      whatsappEnabled = false;
    }
    if (emailEnabled && !hasEmailDestination(contact)) {
      emailEnabled = false;
    }
    if (!smsEnabled && !whatsappEnabled && !emailEnabled) {
      continue;
    }

    const smsBody = renderMessageBody(
      smsTemplate,
      contact,
      queueRow?.renderedBody ?? null,
    );
    const whatsappBody = renderMessageBody(
      whatsappTemplate,
      contact,
      whatsappQueueRow?.renderedBody ?? null,
    );
    const emailBody = renderMessageBody(
      emailTemplate,
      contact,
      emailQueueRow?.renderedBody ?? null,
    );
    const whatsappMediaAssetId =
      whatsappQueueRow?.whatsappMediaAssetId ??
      whatsappTemplate?.whatsappMediaAssetId ??
      null;
    const whatsappMediaFilename = whatsappMediaAssetId
      ? (mediaFilenameByAssetId.get(whatsappMediaAssetId) ?? null)
      : null;

    rows.push({
      id: contact.id,
      name: contact.name,
      mobile: contact.mobile,
      categoryId: contact.categoryId,
      categoryName: contact.category?.name ?? null,
      smsAutomationEnabled: smsEnabled,
      whatsappAutomationEnabled: whatsappEnabled,
      emailAutomationEnabled: emailEnabled,
      sendTimeLabel,
      smsTemplateName: smsTemplate?.name ?? null,
      messagePreview: smsBody ? previewTemplate(smsBody) : null,
      smsMessageBody: smsBody,
      deliveryStatus: queueRow
        ? mapQueueStatus(queueRow.status)
        : "not_scheduled",
      sentAt: queueRow?.sentAt?.toISOString() ?? null,
      failureReason: queueRow?.lastError ?? null,
      whatsappTemplateName: whatsappTemplate?.name ?? null,
      whatsappMessagePreview: whatsappBody
        ? previewTemplate(whatsappBody)
        : null,
      whatsappMessageBody: whatsappBody,
      whatsappMediaAssetId,
      whatsappMediaFilename,
      whatsappMediaPreviewUrl: whatsappMediaAssetId
        ? `/api/v1/whatsapp-media/${whatsappMediaAssetId}`
        : null,
      whatsappDeliveryStatus: whatsappQueueRow
        ? mapQueueStatus(whatsappQueueRow.status)
        : "not_scheduled",
      whatsappSentAt: whatsappQueueRow?.sentAt?.toISOString() ?? null,
      whatsappFailureReason: whatsappQueueRow?.lastError ?? null,
      emailTemplateName: emailTemplate?.name ?? null,
      emailMessagePreview: emailBody ? previewTemplate(emailBody) : null,
      emailMessageBody: emailBody,
      emailDeliveryStatus: emailQueueRow
        ? mapQueueStatus(emailQueueRow.status)
        : "not_scheduled",
      emailSentAt: emailQueueRow?.sentAt?.toISOString() ?? null,
      emailFailureReason: emailQueueRow?.lastError ?? null,
    });
  }

  return rows;
}

export async function getOccasionsDayView(
  organizationId: string,
  targetDateInput?: string,
  categoryId?: string,
): Promise<OccasionsDayView> {
  const isoDate =
    targetDateInput?.trim() ||
    getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE);
  const target = parseTargetDate(isoDate);

  const occasions = await listOccasionOptions(organizationId);
  const occasionIds = occasions.map((occasion) => occasion.id);

  const categoryRules =
    occasionIds.length > 0
      ? await prisma.categoryAutomationRule.findMany({
          where: { organizationId, occasionId: { in: occasionIds } },
        })
      : [];

  const templateIds = [
    ...new Set(
      categoryRules.flatMap((rule) =>
        [rule.smsTemplateId, rule.whatsappTemplateId, rule.emailTemplateId].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ),
  ];

  const templates =
    templateIds.length > 0
      ? await prisma.messageTemplate.findMany({
          where: { organizationId, id: { in: templateIds } },
        })
      : [];

  const templateById = new Map(templates.map((template) => [template.id, template]));

  function rulesMapFor(occasionId: string): Map<string | null, CategoryRuleRouting> {
    const map = new Map<string | null, CategoryRuleRouting>();
    for (const rule of categoryRules) {
      if (rule.occasionId !== occasionId) {
        continue;
      }
      map.set(rule.categoryId, {
        smsEnabled: rule.smsEnabled,
        smsTemplateId: rule.smsTemplateId,
        whatsappEnabled: rule.whatsappEnabled,
        whatsappTemplateId: rule.whatsappTemplateId,
        emailEnabled: rule.emailEnabled,
        emailTemplateId: rule.emailTemplateId,
        sendHour: rule.sendHour,
        sendMinute: rule.sendMinute,
      });
    }
    return map;
  }

  const queueRows =
    occasionIds.length > 0
      ? await prisma.sendQueue.findMany({
          where: {
            organizationId,
            scheduledDate: target.date,
            occasionId: { in: occasionIds },
          },
          select: {
            contactId: true,
            channel: true,
            occasionId: true,
            status: true,
            renderedBody: true,
            whatsappMediaAssetId: true,
            sentAt: true,
            lastError: true,
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
      : [];

  const queueByOccasionAndChannel = new Map<
    string,
    Map<
      string,
      {
        status: QueueStatus;
        renderedBody: string;
        whatsappMediaAssetId: string | null;
        sentAt: Date | null;
        lastError: string | null;
      }
    >
  >();

  for (const row of queueRows) {
    if (!row.contactId) continue;
    const key = `${row.occasionId}:${row.channel}`;
    let byContact = queueByOccasionAndChannel.get(key);
    if (!byContact) {
      byContact = new Map();
      queueByOccasionAndChannel.set(key, byContact);
    }
    byContact.set(row.contactId, {
      status: row.status,
      renderedBody: row.renderedBody,
      whatsappMediaAssetId: row.whatsappMediaAssetId,
      sentAt: row.sentAt,
      lastError: row.lastError,
    });
  }

  const mediaAssetIds = [
    ...templates
      .map((template) => template.whatsappMediaAssetId)
      .filter((id): id is string => Boolean(id)),
    ...queueRows
      .map((row) => row.whatsappMediaAssetId)
      .filter((id): id is string => Boolean(id)),
  ];
  const uniqueMediaIds = [...new Set(mediaAssetIds)];
  const mediaAssets =
    uniqueMediaIds.length > 0
      ? await prisma.whatsAppMediaAsset.findMany({
          where: { organizationId, id: { in: uniqueMediaIds } },
          select: { id: true, filename: true },
        })
      : [];
  const mediaFilenameByAssetId = new Map(
    mediaAssets.map((asset) => [asset.id, asset.filename] as const),
  );

  const pairs = getOccasionMatchPairs(target.month, target.day, target.year);

  const contactsByOccasion = await Promise.all(
    occasions.map((occasion) =>
      loadContactsForOccasion(organizationId, occasion.id, pairs, categoryId),
    ),
  );

  const sections: OccasionDaySection[] = occasions.map((occasion, index) => {
    const rulesByCategoryId = rulesMapFor(occasion.id);
    const allContactsRule = rulesByCategoryId.get(null) ?? null;
    const anyRule = [...rulesByCategoryId.values()];

    const contacts = buildSectionContacts(
      contactsByOccasion[index]!,
      rulesByCategoryId,
      templateById,
      queueByOccasionAndChannel.get(`${occasion.id}:${Channel.SMS}`) ?? new Map(),
      queueByOccasionAndChannel.get(`${occasion.id}:${Channel.WHATSAPP}`) ??
        new Map(),
      queueByOccasionAndChannel.get(`${occasion.id}:${Channel.EMAIL}`) ??
        new Map(),
      mediaFilenameByAssetId,
    );

    return {
      occasionId: occasion.id,
      occasionName: occasion.name,
      label: occasion.name,
      count: contacts.length,
      automationEnabled: anyRule.some((rule) => rule.smsEnabled),
      whatsappAutomationEnabled: anyRule.some((rule) => rule.whatsappEnabled),
      emailAutomationEnabled: anyRule.some((rule) => rule.emailEnabled),
      sendTimeLabel:
        allContactsRule &&
        allContactsRule.sendHour !== null &&
        allContactsRule.sendMinute !== null
          ? `${formatAutomationSendTimeLabel(allContactsRule.sendHour, allContactsRule.sendMinute)} IST`
          : "Send time not set",
      contacts,
    };
  });

  const byOccasion: Record<string, number> = {};
  for (const section of sections) {
    byOccasion[section.occasionId] = section.count;
  }

  return {
    targetDate: target.isoDate,
    timezone: AUTOMATION_TIMEZONE,
    summary: {
      byOccasion,
      total: sections.reduce((sum, section) => sum + section.count, 0),
    },
    sections,
  };
}
