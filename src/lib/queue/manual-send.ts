import { randomUUID } from "node:crypto";

import {
  Channel,
  ChannelProvider,
  Prisma,
  QueueStatus,
  type ChannelConfig,
  type MessageTemplate,
} from "@prisma/client";

import { normalizeMobile } from "@/lib/contacts/mobile";
import { getEffectiveChannelConfig } from "@/lib/channel-config/platform-defaults";
import { prisma } from "@/lib/db";
import { resolveWhatsAppMediaAssetIdForSend } from "@/lib/media/resolve-whatsapp-send-media";
import { TemplateRenderError } from "@/lib/templates/errors";
import { deriveRealSmsReadiness } from "@/lib/templates/readiness";
import {
  previewTemplate,
  renderTemplate,
  renderTemplatePreview,
  templateValuesForContact,
} from "@/lib/templates/variables";
import {
  dedupeContactIds,
  type ManualSendPreviewRequestInput,
  type ManualSendRequestInput,
} from "@/lib/validation/manual-send";

import { getOrganizationLocalIsoDate, parseTargetDate } from "./dates";
import { USAGE_PERIOD_TIMEZONE } from "./constants";
import { prepareQueueDocument } from "./document-preparation";
import {
  QueueTemplateNotFoundError,
  QueueValidationError,
} from "./errors";
import { buildManualSendIdempotencyKey } from "./idempotency";
import {
  assertTemplateEligibleForManualSend,
  getManualSendProviderModeLabel,
  resolveManualSendProviderMode,
  type ManualSendProviderMode,
} from "./manual-send-eligibility";
import {
  getRemainingCapacityForChannel,
  getRemainingMonthlySendCapacity,
  incrementSendUsage,
  lockSubscriptionForQueueGeneration,
} from "./limits";
import { assertWhatsAppTemplateEligibleForManualSend } from "./whatsapp-send-eligibility";
import { resolveWhatsAppParameterValues } from "./whatsapp-snapshots";

export type ManualSendPreviewItem = {
  contactId: string;
  contactName: string;
  renderedPreview: string;
};

export type ManualSendPreviewResult = {
  template: {
    id: string;
    name: string;
    channel: Channel;
    realSmsStatusLabel: string;
  };
  providerMode: ManualSendProviderMode | "TEST";
  providerModeLabel: "Test mode" | "Custom HTTP" | "Resend";
  recipientCount: number;
  media: {
    filename: string;
    contentType: string;
    previewUrl: string;
  } | null;
  previews: ManualSendPreviewItem[];
};

export type ManualSendCreationSummary = {
  operationId: string;
  requested: number;
  created: number;
  skippedLimit: number;
  queueIds: string[];
};

export type ManualSendResult = {
  creation: ManualSendCreationSummary;
  /**
   * Async enqueue summary. Messages are not delivered in this request;
   * workers own provider submission.
   */
  queued: {
    requested: number;
    created: number;
    skippedLimit: number;
  };
};

type ManualSendTemplate = MessageTemplate & {
  occasion: { id: string; name: string };
};

type ManualSendRecipient = {
  key: string;
  contactId: string | null;
  name: string;
  mobile: string;
  email: string | null;
  address: string | null;
  attributes: Prisma.JsonValue;
  isActive: boolean;
};

type PreparedManualSend = {
  operationId: string;
  providerMode: ManualSendProviderMode | "TEST";
  template: ManualSendTemplate;
  recipients: ManualSendRecipient[];
  scheduledDate: Date;
  scheduledDateIso: string;
  renderedBodies: Map<string, string>;
  renderedEmailSubjects: Map<string, string>;
  whatsappParameterValues: Map<string, string[]>;
};

async function loadChannelConfig(
  organizationId: string,
  channel: Channel,
): Promise<ChannelConfig | null> {
  return getEffectiveChannelConfig(organizationId, channel);
}

async function loadManualSendTemplate(
  organizationId: string,
  templateId: string,
): Promise<ManualSendTemplate> {
  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, organizationId },
    include: { occasion: { select: { id: true, name: true } } },
  });

  if (!template) {
    throw new QueueTemplateNotFoundError();
  }

  return template;
}

function resolveManualSendScheduledDate() {
  // Align with worker claim window (IST), same as automation queue generation.
  const scheduledDateIso = getOrganizationLocalIsoDate(USAGE_PERIOD_TIMEZONE);
  const { date } = parseTargetDate(scheduledDateIso);

  return { scheduledDate: date, scheduledDateIso };
}

async function resolveActiveContactsForManualSend(
  organizationId: string,
  contactIds: string[],
): Promise<ManualSendRecipient[]> {
  const contacts = await prisma.contact.findMany({
    where: {
      organizationId,
      id: { in: contactIds },
      isActive: true,
    },
  });

  if (contacts.length !== contactIds.length) {
    throw new QueueValidationError("One or more selected contacts are invalid");
  }

  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));

  return contactIds.map((contactId) => {
    const contact = contactsById.get(contactId)!;
    return {
      key: contact.id,
      contactId: contact.id,
      name: contact.name,
      mobile: contact.mobile,
      email: contact.email,
      address: contact.address,
      attributes: contact.attributes,
      isActive: contact.isActive,
    };
  });
}

function resolveQuickListRecipients(
  recipients: ManualSendRequestInput["recipients"],
): ManualSendRecipient[] {
  const seenMobiles = new Set<string>();
  const resolved: ManualSendRecipient[] = [];

  for (const [index, recipient] of (recipients ?? []).entries()) {
    let mobile: string;
    try {
      mobile = normalizeMobile(recipient.mobile);
    } catch (error) {
      throw new QueueValidationError(
        error instanceof Error ? error.message : "Invalid phone number",
      );
    }

    if (seenMobiles.has(mobile)) {
      continue;
    }
    seenMobiles.add(mobile);

    const name = recipient.name.trim() || "Unnamed Recipient";
    resolved.push({
      key: `quick-${index}-${mobile}`,
      contactId: null,
      name,
      mobile,
      email: recipient.email?.trim() || null,
      address: null,
      attributes: {},
      isActive: true,
    });
  }

  return resolved;
}

function renderManualSendBodies(
  template: MessageTemplate,
  recipients: ManualSendRecipient[],
): Map<string, string> {
  const renderedBodies = new Map<string, string>();

  for (const recipient of recipients) {
    try {
      renderedBodies.set(
        recipient.key,
        renderTemplate(template.body, templateValuesForContact(recipient)),
      );
    } catch (error) {
      if (error instanceof TemplateRenderError) {
        throw new QueueValidationError(
          `Unable to personalize message for ${recipient.name}`,
        );
      }

      throw error;
    }
  }

  return renderedBodies;
}

function resolveManualSendWhatsAppParameters(
  template: MessageTemplate,
  recipients: ManualSendRecipient[],
): Map<string, string[]> {
  const values = new Map<string, string[]>();

  for (const recipient of recipients) {
    values.set(recipient.key, resolveWhatsAppParameterValues(template, recipient));
  }

  return values;
}

async function prepareManualSend(
  organizationId: string,
  input: { templateId: string; contactIds?: string[]; recipients?: ManualSendRequestInput["recipients"] },
  options?: { operationId?: string; allowEmptyRecipients?: boolean },
): Promise<PreparedManualSend> {
  const contactIds = dedupeContactIds(input.contactIds ?? []);
  const template = await loadManualSendTemplate(organizationId, input.templateId);
  const channelConfig = await loadChannelConfig(
    organizationId,
    template.channel,
  );

  let providerMode: ManualSendProviderMode | "TEST";

  if (template.channel === Channel.WHATSAPP) {
    assertWhatsAppTemplateEligibleForManualSend(template, channelConfig);
    providerMode =
      channelConfig?.provider === ChannelProvider.CUSTOM_HTTP
        ? "CUSTOM_HTTP"
        : "TEST";
  } else if (template.channel === Channel.SMS) {
    providerMode = resolveManualSendProviderMode(channelConfig);
    assertTemplateEligibleForManualSend(template, providerMode);
  } else if (template.channel === Channel.EMAIL) {
    if (!template.emailSubject?.trim()) {
      throw new QueueValidationError("Email subject is required");
    }
    providerMode =
      channelConfig?.provider === ChannelProvider.TEST ? "TEST" : "CUSTOM_HTTP";
  } else {
    throw new QueueValidationError("Unsupported messaging channel");
  }

  const contactRecipients = await resolveActiveContactsForManualSend(
    organizationId,
    contactIds,
  );
  const quickRecipients = resolveQuickListRecipients(input.recipients ?? []);
  const recipients = [...contactRecipients, ...quickRecipients];

  if (recipients.length === 0 && !options?.allowEmptyRecipients) {
    throw new QueueValidationError("Select at least one recipient");
  }

  if (template.channel === Channel.EMAIL) {
    const missing = recipients.filter((recipient) => !recipient.email?.trim());
    if (missing.length > 0) {
      throw new QueueValidationError(
        `Email is required for: ${missing.map((c) => c.name).join(", ")}`,
      );
    }
  }

  const { scheduledDate, scheduledDateIso } = resolveManualSendScheduledDate();
  const renderedBodies = renderManualSendBodies(template, recipients);
  const renderedEmailSubjects =
    template.channel === Channel.EMAIL
      ? renderManualSendEmailSubjects(template, recipients)
      : new Map<string, string>();
  const whatsappParameterValues =
    template.channel === Channel.WHATSAPP
      ? resolveManualSendWhatsAppParameters(template, recipients)
      : new Map<string, string[]>();

  return {
    operationId: options?.operationId ?? randomUUID(),
    providerMode,
    template,
    recipients,
    scheduledDate,
    scheduledDateIso,
    renderedBodies,
    renderedEmailSubjects,
    whatsappParameterValues,
  };
}

function renderManualSendEmailSubjects(
  template: MessageTemplate,
  recipients: ManualSendRecipient[],
): Map<string, string> {
  const subjects = new Map<string, string>();
  const subjectTemplate = template.emailSubject?.trim();
  if (!subjectTemplate) {
    throw new QueueValidationError("Email subject is required");
  }

  for (const recipient of recipients) {
    try {
      subjects.set(
        recipient.key,
        renderTemplate(subjectTemplate, templateValuesForContact(recipient)),
      );
    } catch (error) {
      if (error instanceof TemplateRenderError) {
        throw new QueueValidationError(
          `Unable to personalize email subject for ${recipient.name}`,
        );
      }
      throw error;
    }
  }

  return subjects;
}

function serializeTemplatePreviewIdentity(
  template: MessageTemplate,
  providerMode: ManualSendProviderMode | "TEST",
) {
  const readiness = deriveRealSmsReadiness(template);

  return {
    id: template.id,
    name: template.name,
    channel: template.channel,
    realSmsStatusLabel:
      template.channel === Channel.WHATSAPP
        ? providerMode === "CUSTOM_HTTP"
          ? "Custom HTTP"
          : "WhatsApp TEST"
        : readiness.realSmsStatusLabel,
  };
}

function resolveManualSendProviderModeLabel(
  channel: Channel,
  providerMode: ManualSendProviderMode | "TEST",
): "Test mode" | "Custom HTTP" | "Resend" {
  if (channel === Channel.EMAIL) {
    return providerMode === "TEST" ? "Test mode" : "Resend";
  }

  if (channel === Channel.WHATSAPP) {
    return providerMode === "CUSTOM_HTTP" ? "Custom HTTP" : "Test mode";
  }

  return getManualSendProviderModeLabel(providerMode as ManualSendProviderMode);
}

export async function previewManualSend(
  organizationId: string,
  input: ManualSendPreviewRequestInput,
): Promise<ManualSendPreviewResult> {
  const prepared = await prepareManualSend(organizationId, {
    templateId: input.templateId,
    contactIds: input.contactIds ?? [],
    recipients: input.recipients ?? [],
  }, {
    allowEmptyRecipients: true,
  });

  const media = prepared.template.whatsappMediaAssetId
    ? await prisma.whatsAppMediaAsset.findFirst({
        where: {
          id: prepared.template.whatsappMediaAssetId,
          organizationId,
        },
        select: { id: true, filename: true, contentType: true },
      })
    : null;

  const mediaPayload = media
    ? {
        filename: media.filename,
        contentType: media.contentType,
        previewUrl: `/api/v1/whatsapp-media/${media.id}`,
      }
    : null;

  const base = {
    template: serializeTemplatePreviewIdentity(
      prepared.template,
      prepared.providerMode,
    ),
    providerMode: prepared.providerMode,
    providerModeLabel: resolveManualSendProviderModeLabel(
      prepared.template.channel,
      prepared.providerMode,
    ),
    media: mediaPayload,
  };

  if (prepared.recipients.length === 0) {
    let sampleBody: string;
    try {
      sampleBody = renderTemplatePreview(prepared.template.body);
    } catch (error) {
      if (error instanceof TemplateRenderError) {
        throw new QueueValidationError(
          error.message || "Unable to render message preview",
        );
      }
      throw error;
    }

    return {
      ...base,
      recipientCount: 0,
      previews: [
        {
          contactId: "sample",
          contactName: "Sample",
          renderedPreview: previewTemplate(sampleBody),
        },
      ],
    };
  }

  return {
    ...base,
    recipientCount: prepared.recipients.length,
    previews: prepared.recipients.map((recipient) => ({
      contactId: recipient.contactId ?? recipient.key,
      contactName: recipient.name,
      renderedPreview: previewTemplate(prepared.renderedBodies.get(recipient.key)!),
    })),
  };
}

async function createManualSendQueueItems(
  organizationId: string,
  prepared: PreparedManualSend,
  createdByUserId: string,
): Promise<ManualSendCreationSummary> {
  const summary: ManualSendCreationSummary = {
    operationId: prepared.operationId,
    requested: prepared.recipients.length,
    created: 0,
    skippedLimit: 0,
    queueIds: [],
  };

  // Collected while creating rows, prepared AFTER the transaction commits -
  // PDF generation and the B2 upload it triggers must never hold the queue
  // transaction open, and one recipient's failure must never affect
  // another's already-committed row (see prepareQueueDocument, and the
  // identical pattern in generateOccasionQueue for scheduled sends).
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

  const whatsappMediaByContactId = new Map<string, string | null>();
  if (prepared.template.channel === Channel.WHATSAPP) {
    for (const recipient of prepared.recipients) {
      const mediaId = await resolveWhatsAppMediaAssetIdForSend({
        organizationId,
        template: prepared.template,
        contactId: recipient.contactId ?? recipient.key,
        contactName: recipient.name,
        occasionName: prepared.template.occasion.name,
      });
      whatsappMediaByContactId.set(recipient.key, mediaId);
    }
  }

  await prisma.$transaction(
    async (tx) => {
    const { subscription, channelLimits } = await lockSubscriptionForQueueGeneration(
      organizationId,
      tx,
    );
    let remaining = getRemainingMonthlySendCapacity(subscription);

    for (const recipient of prepared.recipients) {
      if (
        getRemainingCapacityForChannel(
          subscription,
          channelLimits,
          prepared.template.channel,
          remaining,
        ) <= 0
      ) {
        summary.skippedLimit += 1;
        continue;
      }

      const idempotencyKey = buildManualSendIdempotencyKey({
        operationId: prepared.operationId,
        contactId: recipient.contactId ?? recipient.key,
        templateId: prepared.template.id,
        channel: prepared.template.channel,
        occasionId: prepared.template.occasionId,
      });

      const existing = await tx.sendQueue.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId,
            idempotencyKey,
          },
        },
        select: { id: true },
      });

      if (existing) {
        // Idempotent replay of the same clientOperationId - do not
        // double-count usage or create a second queue row.
        summary.created += 1;
        summary.queueIds.push(existing.id);
        continue;
      }

      try {
        const created = await tx.sendQueue.create({
          data: {
            organizationId,
            contactId: recipient.contactId,
            recipientName: recipient.name,
            recipientMobile: recipient.mobile,
            recipientEmail: recipient.email,
            templateId: prepared.template.id,
            channel: prepared.template.channel,
            occasionId: prepared.template.occasionId,
            scheduledDate: prepared.scheduledDate,
            renderedBody: prepared.renderedBodies.get(recipient.key)!,
            ...(prepared.template.channel === Channel.EMAIL
              ? {
                  emailSubject:
                    prepared.renderedEmailSubjects.get(recipient.key)!,
                }
              : {}),
            ...(prepared.template.channel === Channel.WHATSAPP
              ? {
                  whatsappTemplateName:
                    prepared.template.whatsappTemplateName!.trim(),
                  whatsappLanguage: prepared.template.whatsappLanguage!.trim(),
                  whatsappParameterValues:
                    prepared.whatsappParameterValues.get(recipient.key) ?? [],
                  whatsappMediaAssetId:
                    whatsappMediaByContactId.get(recipient.key) ?? null,
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
          prepared.template.channel,
        );

        summary.created += 1;
        summary.queueIds.push(created.id);
        remaining -= 1;

        if (prepared.template.includePersonalizedPdf) {
          pendingDocumentTasks.push({
            sendQueueId: created.id,
            documentTemplateId: prepared.template.documentTemplateId,
            contact: {
              name: recipient.name,
              email: recipient.email,
              mobile: recipient.mobile,
              address: recipient.address,
              attributes: recipient.attributes,
            },
          });
        }
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new QueueValidationError(
            "Duplicate contact selection is not allowed",
          );
        }

        throw error;
      }
    }
  },
    { maxWait: 60_000, timeout: 120_000 },
  );

  // Outside the transaction, one recipient at a time: PDF rendering and the
  // B2 upload it triggers are network/CPU-bound and must not hold a DB
  // transaction open, and one recipient's failure must never affect
  // another's already-committed row (see prepareQueueDocument).
  for (const task of pendingDocumentTasks) {
    await prepareQueueDocument({
      organizationId,
      sendQueueId: task.sendQueueId,
      createdByUserId,
      documentTemplateId: task.documentTemplateId,
      contact: task.contact,
    });
  }

  return summary;
}

/**
 * Manual Send creates/reserves durable queue work only. Workers deliver later.
 * `actor.createdByUserId` attributes any personalized PDF generated for this
 * send to the admin who actually clicked Send Now (unlike scheduled
 * automation, which has no human actor and falls back to "any org admin").
 */
export async function executeManualSend(
  organizationId: string,
  input: ManualSendRequestInput,
  actor: { createdByUserId: string },
): Promise<ManualSendResult> {
  const prepared = await prepareManualSend(organizationId, input, {
    operationId: input.clientOperationId ?? randomUUID(),
  });
  const creation = await createManualSendQueueItems(
    organizationId,
    prepared,
    actor.createdByUserId,
  );

  return {
    creation,
    queued: {
      requested: creation.requested,
      created: creation.created,
      skippedLimit: creation.skippedLimit,
    },
  };
}
