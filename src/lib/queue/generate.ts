import {
  Channel,
  Prisma,
  QueueStatus,
  UserRole,
  type MessageTemplate,
} from "@prisma/client";

import { isAtOrAfterAutomationSendTime } from "@/lib/automation/send-time";
import type { ActiveCategoryChannelRule } from "@/lib/automation/category-settings";
import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";
import { prisma } from "@/lib/db";
import { resolveWhatsAppMediaAssetIdForSend } from "@/lib/media/resolve-whatsapp-send-media";
import { TemplateRenderError } from "@/lib/templates/errors";
import { renderTemplate, templateValuesForContact } from "@/lib/templates/variables";
import type { GenerateQueueInput } from "@/lib/validation/queue";

import {
  getOccasionMatchPairs,
  getOrganizationLocalIsoDate,
  parseTargetDate,
} from "./dates";
import { prepareQueueDocument } from "./document-preparation";
import {
  QueueTemplateNotFoundError,
  QueueTemplateRejectedError,
  QueueValidationError,
} from "./errors";
import { buildOccasionIdempotencyKey } from "./idempotency";
import {
  getRemainingCapacityForChannel,
  getRemainingMonthlySendCapacity,
  incrementSendUsage,
  lockSubscriptionForQueueGeneration,
} from "./limits";
import { resolveWhatsAppParameterValues } from "./whatsapp-snapshots";

export type QueueGenerationSummary = {
  targetDate: string;
  templateId: string;
  eligible: number;
  created: number;
  queueIds: string[];
  skippedDuplicate: number;
  skippedIneligible: number;
  skippedLimit: number;
  unprocessedByBound: number;
  generationIncomplete: boolean;
};

export type GenerateOccasionQueueOptions = {
  maxCreates?: number;
  /**
   * When set, only contacts matching one of these category rules (or the
   * categoryId=null "all contacts" rule) are queued, using each rule's
   * template and send-time window (IST).
   */
  categoryRules?: ActiveCategoryChannelRule[];
  /** Required with categoryRules so per-row send times can be enforced. */
  referenceDate?: Date;
  /** Owner catch-up: queue now even if the IST send window has not opened. */
  skipSendTimeGate?: boolean;
};

const CONTACT_SCAN_PAGE_SIZE = 2000;

async function processContactsInPages(
  tx: Prisma.TransactionClient,
  where: Prisma.ContactWhereInput,
  onContact: (contact: {
    id: string;
    name: string;
    mobile: string;
    email: string | null;
    address: string | null;
    attributes: Prisma.JsonValue;
    categoryId: string | null;
  }) => Promise<void>,
) {
  let skip = 0;

  while (true) {
    const page = await tx.contact.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip,
      take: CONTACT_SCAN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        mobile: true,
        email: true,
        address: true,
        attributes: true,
        categoryId: true,
      },
    });

    if (page.length === 0) {
      return;
    }

    for (const contact of page) {
      await onContact(contact);
    }

    skip += page.length;
    if (page.length < CONTACT_SCAN_PAGE_SIZE) {
      return;
    }
  }
}

function hasChannelDestination(
  channel: "SMS" | "WHATSAPP" | "EMAIL",
  contact: { mobile: string; name: string; email?: string | null },
): boolean {
  if (!contact.name.trim()) {
    return false;
  }

  if (channel === "EMAIL") {
    return Boolean(contact.email?.trim());
  }

  if (!contact.mobile.trim()) {
    return false;
  }

  return channel === "SMS" || channel === "WHATSAPP";
}

function resolveTargetDate(targetDate?: string) {
  try {
    if (targetDate) {
      return parseTargetDate(targetDate);
    }

    // Occasion matching always uses IST (same calendar day as automation).
    const isoDate = getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE);
    return parseTargetDate(isoDate);
  } catch (error) {
    throw new QueueValidationError(
      error instanceof Error ? error.message : "Invalid target date",
    );
  }
}

async function loadOccasionTemplate(
  organizationId: string,
  occasionId: string,
  templateId: string,
) {
  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, organizationId },
  });

  if (!template) {
    throw new QueueTemplateNotFoundError();
  }

  if (!template.isActive) {
    throw new QueueTemplateRejectedError("Template is inactive");
  }

  if (template.occasionId !== occasionId) {
    throw new QueueTemplateRejectedError(
      "Template occasion does not match this queue generation",
    );
  }

  if (
    template.channel !== Channel.SMS &&
    template.channel !== Channel.WHATSAPP &&
    template.channel !== Channel.EMAIL
  ) {
    throw new QueueTemplateRejectedError(
      "Only SMS, WhatsApp, or Email templates can be used for queue generation",
    );
  }
  if (
    template.channel === Channel.EMAIL &&
    !template.emailSubject?.trim()
  ) {
    throw new QueueTemplateRejectedError("Email subject is required");
  }
  if (
    template.channel === Channel.WHATSAPP &&
    (!template.whatsappTemplateName?.trim() ||
      !template.whatsappLanguage?.trim())
  ) {
    throw new QueueTemplateRejectedError(
      "WhatsApp template name and language are required",
    );
  }

  return template;
}

/**
 * Generates queued sends for one occasion, for any organization. Replaces
 * the old generateBirthdayQueue/generateAnniversaryQueue/generateCustomQueue
 * (identical except which Contact field pair they matched and which enum
 * value they stamped) - contact eligibility now comes from ContactOccasionDate.
 */
export async function generateOccasionQueue(
  organizationId: string,
  occasionId: string,
  input: GenerateQueueInput,
  options: GenerateOccasionQueueOptions = {},
): Promise<QueueGenerationSummary> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });

  if (!organization) {
    throw new QueueValidationError("Organization not found");
  }

  const occasion = await prisma.occasion.findFirst({
    where: { id: occasionId, organizationId },
    select: { name: true },
  });
  if (!occasion) {
    throw new QueueValidationError("Occasion not found");
  }

  const target = resolveTargetDate(input.targetDate);
  const categoryRules = options.categoryRules ?? [];
  const usingCategoryRules = categoryRules.length > 0;

  const templatesById = new Map<string, MessageTemplate>();
  if (usingCategoryRules) {
    const templateIds = [...new Set(categoryRules.map((rule) => rule.templateId))];
    for (const templateId of templateIds) {
      templatesById.set(
        templateId,
        await loadOccasionTemplate(organizationId, occasionId, templateId),
      );
    }
  }

  const template = usingCategoryRules
    ? templatesById.get(categoryRules[0]!.templateId)!
    : await loadOccasionTemplate(organizationId, occasionId, input.templateId);

  const pairs = getOccasionMatchPairs(target.month, target.day, target.year);

  const ruleByCategory = new Map(
    categoryRules.map((rule) => [rule.categoryId, rule] as const),
  );
  const hasAllContactsRule = ruleByCategory.has(null);
  const specificCategoryIds = categoryRules
    .map((rule) => rule.categoryId)
    .filter((id): id is string => id !== null);

  const eligibleWhere: Prisma.ContactWhereInput = {
    organizationId,
    isActive: true,
    occasionDates: {
      some: {
        occasionId,
        OR: pairs.map((pair) => ({ month: pair.month, day: pair.day })),
      },
    },
    ...(usingCategoryRules && !hasAllContactsRule
      ? { categoryId: { in: specificCategoryIds } }
      : {}),
  };

  const eligible = await prisma.contact.count({ where: eligibleWhere });

  console.info("Queue generation started", {
    organizationId,
    occasionId,
    targetDate: target.isoDate,
    channel: template.channel,
    usingCategoryRules,
    ruleCount: categoryRules.length,
    maxCreates: options.maxCreates ?? "unbounded",
    eligibleCount: eligible,
  });

  const summary: QueueGenerationSummary = {
    targetDate: target.isoDate,
    templateId: template.id,
    eligible,
    created: 0,
    queueIds: [],
    skippedDuplicate: 0,
    skippedIneligible: 0,
    skippedLimit: 0,
    unprocessedByBound: 0,
    generationIncomplete: false,
  };

  if (eligible === 0) {
    return summary;
  }

  const maxCreates =
    options.maxCreates !== undefined
      ? Math.max(0, options.maxCreates)
      : Number.POSITIVE_INFINITY;
  let createsRemaining = maxCreates;
  const referenceDate = options.referenceDate ?? new Date();
  const skipSendTimeGate = options.skipSendTimeGate === true;

  // Collected while creating rows, prepared AFTER the transaction commits -
  // PDF generation and the B2 upload it triggers must never hold the queue
  // transaction open (see prepareQueueDocument).
  const pendingDocumentTasks: Array<{
    sendQueueId: string;
    documentTemplateId: string | null;
    contact: {
      name: string;
      email: string | null;
      mobile: string;
      address: string | null;
      attributes: Prisma.JsonValue;
    };
  }> = [];

  await prisma.$transaction(async (tx) => {
    const { subscription, channelLimits } = await lockSubscriptionForQueueGeneration(
      organizationId,
      tx,
    );
    let remaining = getRemainingMonthlySendCapacity(subscription);

    await processContactsInPages(tx, eligibleWhere, async (contact) => {
      const logSkip = (reason: string, extra: Record<string, unknown> = {}) => {
        console.info("Queue generation: contact skipped", {
          organizationId,
          occasionId,
          contactId: contact.id,
          categoryId: contact.categoryId,
          reason,
          ...extra,
        });
      };

      if (createsRemaining <= 0) {
        summary.unprocessedByBound += 1;
        logSkip("unprocessed_by_bound", { maxCreates });
        return;
      }

      let contactTemplate = template;

      if (usingCategoryRules) {
        const rule = contact.categoryId
          ? (ruleByCategory.get(contact.categoryId) ?? ruleByCategory.get(null))
          : ruleByCategory.get(null);
        if (!rule) {
          summary.skippedIneligible += 1;
          logSkip("no_matching_category_rule");
          return;
        }
        if (
          !skipSendTimeGate &&
          !isAtOrAfterAutomationSendTime(
            rule.sendHour,
            rule.sendMinute,
            referenceDate,
          )
        ) {
          summary.skippedIneligible += 1;
          logSkip("before_send_time_window", {
            sendHour: rule.sendHour,
            sendMinute: rule.sendMinute,
          });
          return;
        }
        const resolved = templatesById.get(rule.templateId);
        if (!resolved) {
          summary.skippedIneligible += 1;
          logSkip("rule_template_not_loaded", { templateId: rule.templateId });
          return;
        }
        contactTemplate = resolved;
      }

      if (!hasChannelDestination(contactTemplate.channel, contact)) {
        summary.skippedIneligible += 1;
        logSkip("missing_channel_destination", { channel: contactTemplate.channel });
        return;
      }

      let renderedBody: string;

      try {
        renderedBody = renderTemplate(contactTemplate.body, {
          ...templateValuesForContact(contact),
        });
      } catch (error) {
        if (error instanceof TemplateRenderError) {
          summary.skippedIneligible += 1;
          logSkip("template_render_failed", { error: error.message });
          return;
        }

        throw error;
      }

      const idempotencyKey = buildOccasionIdempotencyKey({
        contactId: contact.id,
        channel: contactTemplate.channel,
        occasionId,
        targetDate: target.isoDate,
      });

      const existing = await tx.sendQueue.findFirst({
        where: {
          organizationId,
          contactId: contact.id,
          channel: contactTemplate.channel,
          occasionId,
          scheduledDate: target.date,
        },
        select: { id: true },
      });

      if (existing) {
        summary.skippedDuplicate += 1;
        logSkip("duplicate_existing_queue_row", { existingQueueId: existing.id });
        return;
      }

      if (
        getRemainingCapacityForChannel(
          subscription,
          channelLimits,
          contactTemplate.channel,
          remaining,
        ) <= 0
      ) {
        summary.skippedLimit += 1;
        logSkip("send_capacity_exhausted", { channel: contactTemplate.channel });
        return;
      }

      const whatsappMediaAssetId =
        contactTemplate.channel === Channel.WHATSAPP
          ? await resolveWhatsAppMediaAssetIdForSend({
              organizationId,
              template: contactTemplate,
              contactId: contact.id,
              contactName: contact.name,
              occasionName: occasion.name,
            })
          : null;

      try {
        const created = await tx.sendQueue.create({
          data: {
            organizationId,
            contactId: contact.id,
            recipientName: contact.name,
            recipientMobile: contact.mobile,
            recipientEmail: contact.email,
            templateId: contactTemplate.id,
            channel: contactTemplate.channel,
            occasionId,
            scheduledDate: target.date,
            renderedBody,
            ...(contactTemplate.channel === Channel.EMAIL
              ? {
                  emailSubject: renderTemplate(
                    contactTemplate.emailSubject!.trim(),
                    templateValuesForContact(contact),
                  ),
                }
              : {}),
            ...(contactTemplate.channel === Channel.WHATSAPP
              ? {
                  whatsappTemplateName:
                    contactTemplate.whatsappTemplateName!.trim(),
                  whatsappLanguage: contactTemplate.whatsappLanguage!.trim(),
                  whatsappParameterValues: resolveWhatsAppParameterValues(
                    contactTemplate,
                    contact,
                  ),
                  whatsappMediaAssetId,
                }
              : {}),
            status: QueueStatus.PENDING,
            idempotencyKey,
          },
        });

        await incrementSendUsage(
          tx,
          subscription,
          channelLimits,
          contactTemplate.channel,
        );

        summary.created += 1;
        summary.queueIds.push(created.id);
        remaining -= 1;
        createsRemaining -= 1;

        console.info("Queue generation: contact queued", {
          organizationId,
          occasionId,
          contactId: contact.id,
          sendQueueId: created.id,
          channel: contactTemplate.channel,
          idempotencyKey,
        });

        if (contactTemplate.includePersonalizedPdf) {
          pendingDocumentTasks.push({
            sendQueueId: created.id,
            documentTemplateId: contactTemplate.documentTemplateId,
            contact: {
              name: contact.name,
              email: contact.email,
              mobile: contact.mobile,
              address: contact.address,
              attributes: contact.attributes,
            },
          });
        }
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          summary.skippedDuplicate += 1;
          logSkip("duplicate_unique_constraint_race");
          return;
        }

        throw error;
      }
    });
  }, { maxWait: 60_000, timeout: 300_000 });

  // Outside the transaction, one contact at a time: PDF rendering and the B2
  // upload it triggers are network/CPU-bound and must not hold a DB
  // transaction open, and one contact's failure must never affect another's
  // already-committed row (see prepareQueueDocument).
  if (pendingDocumentTasks.length > 0) {
    const createdByUserId = await resolveAutomationCreatedByUserId(organizationId);
    for (const task of pendingDocumentTasks) {
      if (!createdByUserId) {
        await prisma.sendQueue.update({
          where: { id: task.sendQueueId },
          data: {
            status: QueueStatus.FAILED,
            lastError: "No admin user found to attribute the generated document to",
            lastErrorCode: "DOCUMENT_ATTRIBUTION_MISSING",
            nextAttemptAt: null,
          },
        });
        continue;
      }

      await prepareQueueDocument({
        organizationId,
        sendQueueId: task.sendQueueId,
        createdByUserId,
        documentTemplateId: task.documentTemplateId,
        contact: task.contact,
      });
    }
  }

  summary.generationIncomplete = summary.unprocessedByBound > 0;

  console.info("Queue generation finished", {
    organizationId,
    occasionId,
    ...summary,
  });

  return summary;
}

async function generateLegacyOccasionQueue(
  organizationId: string,
  occasionName: string,
  input: GenerateQueueInput,
  options: GenerateOccasionQueueOptions = {},
): Promise<QueueGenerationSummary> {
  const occasion = await prisma.occasion.findFirst({
    where: { organizationId, name: occasionName },
    select: { id: true },
  });

  if (!occasion) {
    throw new QueueValidationError("Occasion not found");
  }

  return generateOccasionQueue(organizationId, occasion.id, input, options);
}

/** Compatibility wrappers for callers that still use the former fixed occasions. */
export function generateBirthdayQueue(
  organizationId: string,
  input: GenerateQueueInput,
  options: GenerateOccasionQueueOptions = {},
) {
  return generateLegacyOccasionQueue(organizationId, "Birthday", input, options);
}

export function generateAnniversaryQueue(
  organizationId: string,
  input: GenerateQueueInput,
  options: GenerateOccasionQueueOptions = {},
) {
  return generateLegacyOccasionQueue(
    organizationId,
    "Anniversary",
    input,
    options,
  );
}

export function generateCustomQueue(
  organizationId: string,
  input: GenerateQueueInput,
  options: GenerateOccasionQueueOptions = {},
) {
  return generateLegacyOccasionQueue(organizationId, "Custom", input, options);
}

/** Audit-only attribution for automation-triggered document generation (see GeneratedDocument.createdByUserId). */
async function resolveAutomationCreatedByUserId(
  organizationId: string,
): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { organizationId, role: UserRole.ADMIN },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return admin?.id ?? null;
}
