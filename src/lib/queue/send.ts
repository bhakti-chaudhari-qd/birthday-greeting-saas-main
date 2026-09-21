import {
  Channel,
  ChannelProvider,
  DeliveryStatus,
  Prisma,
  QueueStatus,
} from "@prisma/client";

import {
  SubscriptionBlockedError,
  assertSubscriptionAllowsSending,
} from "@/lib/abuse/subscription-send";
import {
  SEND_VELOCITY_LIMIT_CODE,
  SendVelocityError,
  assertAndRecordSendVelocity,
  getOrganizationSendVelocityBudget,
} from "@/lib/abuse/velocity";
import {
  getAutomationSendInstant,
  isAtOrAfterAutomationSendTime,
  isAutomationOriginatedIdempotencyKey,
} from "@/lib/automation/send-time";
import { getMessageProvider, ProviderSendError } from "@/lib/messaging/providers";
import { getEffectiveChannelConfig } from "@/lib/channel-config/platform-defaults";
import { prisma } from "@/lib/db";
import type { DocumentStorage } from "@/lib/storage";
import { assertTemplateReadyForCustomHttpSend } from "@/lib/templates/sms-setup";
import { TemplateValidationError } from "@/lib/templates/errors";

import { computeNextAttemptAt, type BackoffRandom } from "./backoff";
import { classifySendFailure } from "./classify";
import { ensureQueueDocumentForRetry } from "./document-preparation";
import {
  AMBIGUOUS_PROVIDER_OUTCOME,
  AMBIGUOUS_PROVIDER_OUTCOME_MESSAGE,
  MAX_SEND_ATTEMPTS,
  QUEUE_LEASE_DURATION_MS,
} from "./constants";
import {
  resolveEmailPdfAttachment,
  resolveWhatsAppPdfAttachment,
} from "./document-attachment";
import {
  QueueInvalidStateError,
  QueueMaxAttemptsError,
  QueueNotFoundError,
  QueueValidationError,
} from "./errors";
import { serializeQueueItem } from "./serialize";
import { assertWhatsAppQueueSnapshots } from "./whatsapp-snapshots";

export type SendQueueItemResult = {
  queueId: string;
  status: "sent" | "failed" | "skipped" | "retry_scheduled" | "ambiguous";
  queue?: ReturnType<typeof serializeQueueItem>;
  error?: string;
  errorCode?: string;
};

export type ProcessQueueItemOptions = {
  now?: Date;
  random?: BackoffRandom;
  /** Test-only storage override for personalized PDF retrieval; defaults to the real document storage. */
  storage?: DocumentStorage;
};

type QueueWithRelations = Awaited<
  ReturnType<typeof loadClaimedQueueContext>
>;

function queueRecipientName(queue: NonNullable<QueueWithRelations>): string {
  return queue.contact?.name ?? queue.recipientName;
}

function queueRecipientMobile(queue: NonNullable<QueueWithRelations>): string {
  return queue.contact?.mobile ?? queue.recipientMobile;
}

function maskRecipientForLog(mobile: string): string {
  return mobile.length <= 4 ? mobile : `${"*".repeat(mobile.length - 4)}${mobile.slice(-4)}`;
}

function queueRecipientEmail(queue: NonNullable<QueueWithRelations>): string | null {
  return queue.contact?.email ?? queue.recipientEmail;
}

async function loadClaimedQueueContext(organizationId: string, queueId: string) {
  return prisma.sendQueue.findFirst({
    where: { id: queueId, organizationId, status: QueueStatus.SENDING },
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          mobile: true,
          email: true,
          categoryId: true,
          isActive: true,
        },
      },
      template: {
        select: {
          id: true,
          name: true,
          channel: true,
          body: true,
          emailSubject: true,
          dltTemplateId: true,
          dltApprovedContent: true,
          includePersonalizedPdf: true,
        },
      },
      whatsappMediaAsset: {
        select: {
          bytes: true,
          filename: true,
          contentType: true,
        },
      },
      organization: {
        select: {
          id: true,
          isActive: true,
        },
      },
    },
  });
}

function clearClaimFields() {
  return {
    claimedAt: null,
    leaseExpiresAt: null,
    providerAttemptStartedAt: null,
  };
}

type AutomationSendSchedule = {
  sendHour: number | null;
  sendMinute: number | null;
  source: "category" | "organization";
};

function ruleMatchesQueueChannel(
  queue: NonNullable<QueueWithRelations>,
  rule: {
    smsEnabled: boolean;
    smsTemplateId: string | null;
    whatsappEnabled: boolean;
    whatsappTemplateId: string | null;
    emailEnabled: boolean;
    emailTemplateId: string | null;
  },
): boolean {
  if (queue.channel === Channel.SMS) {
    return rule.smsEnabled && rule.smsTemplateId === queue.templateId;
  }
  if (queue.channel === Channel.WHATSAPP) {
    return (
      rule.whatsappEnabled && rule.whatsappTemplateId === queue.templateId
    );
  }
  if (queue.channel === Channel.EMAIL) {
    return rule.emailEnabled && rule.emailTemplateId === queue.templateId;
  }
  return false;
}

const AUTOMATION_RULE_SELECT = {
  sendHour: true,
  sendMinute: true,
  smsEnabled: true,
  smsTemplateId: true,
  whatsappEnabled: true,
  whatsappTemplateId: true,
  emailEnabled: true,
  emailTemplateId: true,
} as const;

/**
 * A CategoryAutomationRule with categoryId=null is the "all contacts" row
 * for the occasion (what used to be Organization's org-wide scalar fields).
 * A contact's category-specific rule wins when both exist.
 */
async function resolveAutomationSendSchedule(
  organizationId: string,
  queue: NonNullable<QueueWithRelations>,
): Promise<AutomationSendSchedule> {
  if (queue.contact?.categoryId) {
    const rule = await prisma.categoryAutomationRule.findFirst({
      where: {
        organizationId,
        occasionId: queue.occasionId,
        categoryId: queue.contact.categoryId,
      },
      select: AUTOMATION_RULE_SELECT,
    });

    if (rule && ruleMatchesQueueChannel(queue, rule)) {
      return {
        sendHour: rule.sendHour,
        sendMinute: rule.sendMinute,
        source: "category",
      };
    }
  }

  const allContactsRule = await prisma.categoryAutomationRule.findFirst({
    where: {
      organizationId,
      occasionId: queue.occasionId,
      categoryId: null,
    },
    select: AUTOMATION_RULE_SELECT,
  });

  if (allContactsRule && ruleMatchesQueueChannel(queue, allContactsRule)) {
    return {
      sendHour: allContactsRule.sendHour,
      sendMinute: allContactsRule.sendMinute,
      source: "organization",
    };
  }

  return { sendHour: null, sendMinute: null, source: "organization" };
}

/**
 * Velocity is a throttle, not a hard failure: release the claim, keep PENDING,
 * and retry after the current minute/day window without burning attemptCount.
 */
async function deferForSendVelocity(
  organizationId: string,
  queue: NonNullable<QueueWithRelations>,
  message: string,
  now: Date,
): Promise<SendQueueItemResult> {
  const budget = await getOrganizationSendVelocityBudget(organizationId, now);
  const nextAttemptAt = new Date(now.getTime() + budget.retryAfterMs);

  const updated = await prisma.sendQueue.update({
    where: { id: queue.id },
    data: {
      status: QueueStatus.PENDING,
      nextAttemptAt,
      lastErrorCode: SEND_VELOCITY_LIMIT_CODE,
      lastError: message,
      ...clearClaimFields(),
    },
    include: {
      contact: { select: { id: true, name: true, mobile: true } },
      template: { select: { id: true, name: true } },
    },
  });

  return {
    queueId: queue.id,
    status: "retry_scheduled",
    queue: serializeQueueItem(updated),
    error: message,
    errorCode: SEND_VELOCITY_LIMIT_CODE,
  };
}

async function finalizeSkippedInactive(
  organizationId: string,
  queueId: string,
): Promise<SendQueueItemResult> {
  const updated = await prisma.sendQueue.update({
    where: { id: queueId },
    data: {
      status: QueueStatus.SKIPPED,
      skippedAt: new Date(),
      lastError: "Contact is inactive",
      lastErrorCode: "CONTACT_INACTIVE",
      ...clearClaimFields(),
      nextAttemptAt: null,
    },
    include: {
      contact: { select: { id: true, name: true, mobile: true } },
      template: { select: { id: true, name: true } },
    },
  });

  return {
    queueId,
    status: "skipped",
    queue: serializeQueueItem(updated),
    error: "Contact is inactive",
    errorCode: "CONTACT_INACTIVE",
  };
}

async function markProviderAttemptStarted(
  organizationId: string,
  queueId: string,
  now: Date,
) {
  const updated = await prisma.sendQueue.updateMany({
    where: {
      id: queueId,
      organizationId,
      status: QueueStatus.SENDING,
      providerAttemptStartedAt: null,
    },
    data: {
      providerAttemptStartedAt: now,
    },
  });

  return updated.count === 1;
}

async function finalizeSuccess(
  organizationId: string,
  queue: NonNullable<QueueWithRelations>,
  attemptNumber: number,
  providerName: string,
  providerResult: { providerMessageId: string; units?: number },
): Promise<SendQueueItemResult> {
  const updated = await prisma.$transaction(async (tx) => {
    await tx.deliveryLog.create({
      data: {
        organizationId,
        sendQueueId: queue.id,
        attemptNumber,
        status: DeliveryStatus.SENT,
        providerMessageId: providerResult.providerMessageId,
        providerResponse: {
          provider: providerName,
          ...(queue.whatsappMediaAsset
            ? {
                media: {
                  filename: queue.whatsappMediaAsset.filename,
                  contentType: queue.whatsappMediaAsset.contentType,
                  simulated: providerName === ChannelProvider.TEST,
                },
              }
            : {}),
          ...(providerResult.units !== undefined
            ? { units: providerResult.units }
            : {}),
        },
      },
    });

    return tx.sendQueue.update({
      where: { id: queue.id },
      data: {
        status: QueueStatus.SENT,
        attemptCount: attemptNumber,
        lastError: null,
        lastErrorCode: null,
        sentAt: new Date(),
        nextAttemptAt: null,
        ...clearClaimFields(),
      },
      include: {
        contact: { select: { id: true, name: true, mobile: true } },
        template: { select: { id: true, name: true } },
      },
    });
  });

  return {
    queueId: queue.id,
    status: "sent",
    queue: serializeQueueItem(updated),
  };
}

async function finalizeFailure(
  organizationId: string,
  queue: NonNullable<QueueWithRelations>,
  attemptNumber: number,
  providerName: string,
  errorMessage: string,
  errorCode: string,
  random?: BackoffRandom,
): Promise<SendQueueItemResult> {
  const classification = classifySendFailure(errorCode);
  const atMaxAttempts = attemptNumber >= MAX_SEND_ATTEMPTS;

  let nextAttemptAt: Date | null = null;
  let resultStatus: SendQueueItemResult["status"] = "failed";
  let finalCode = errorCode;
  let finalMessage = errorMessage;

  if (classification === "ambiguous" || errorCode === AMBIGUOUS_PROVIDER_OUTCOME) {
    finalCode = AMBIGUOUS_PROVIDER_OUTCOME;
    finalMessage = AMBIGUOUS_PROVIDER_OUTCOME_MESSAGE;
    nextAttemptAt = null;
    resultStatus = "ambiguous";
  } else if (classification === "retryable" && !atMaxAttempts) {
    if (errorCode === SEND_VELOCITY_LIMIT_CODE) {
      const budget = await getOrganizationSendVelocityBudget(organizationId);
      nextAttemptAt = new Date(Date.now() + budget.retryAfterMs);
    } else {
      nextAttemptAt = computeNextAttemptAt(attemptNumber, new Date(), random);
    }
    resultStatus = "retry_scheduled";
  } else {
    nextAttemptAt = null;
    resultStatus = "failed";
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.deliveryLog.create({
      data: {
        organizationId,
        sendQueueId: queue.id,
        attemptNumber,
        status: DeliveryStatus.FAILED,
        errorCode: finalCode,
        errorMessage: finalMessage,
        providerResponse: {
          provider: providerName,
          ...(finalCode !== errorCode || finalMessage !== errorMessage
            ? {
                originalErrorCode: errorCode,
                originalErrorMessage: errorMessage,
              }
            : {}),
        },
      },
    });

    return tx.sendQueue.update({
      where: { id: queue.id },
      data: {
        status: QueueStatus.FAILED,
        attemptCount: attemptNumber,
        lastError: finalMessage,
        lastErrorCode: finalCode,
        nextAttemptAt,
        ...clearClaimFields(),
      },
      include: {
        contact: { select: { id: true, name: true, mobile: true } },
        template: { select: { id: true, name: true } },
      },
    });
  });

  return {
    queueId: queue.id,
    status: resultStatus,
    queue: serializeQueueItem(updated),
    error: finalMessage,
    errorCode: finalCode,
  };
}

/**
 * Process a queue row that is already claimed (SENDING) with a valid lease.
 * Provider HTTP runs outside long-running database transactions.
 */
export async function processClaimedQueueItem(
  organizationId: string,
  queueId: string,
  options: ProcessQueueItemOptions = {},
): Promise<SendQueueItemResult> {
  const now = options.now ?? new Date();

  const queue = await loadClaimedQueueContext(organizationId, queueId);

  if (!queue) {
    return {
      queueId,
      status: "skipped",
      error: "Queue item is not in a claimed sendable state",
    };
  }

  if (!queue.organization.isActive) {
    const restoreStatus =
      queue.attemptCount === 0 ? QueueStatus.PENDING : QueueStatus.FAILED;
    const updated = await prisma.sendQueue.update({
      where: { id: queue.id },
      data: {
        status: restoreStatus,
        nextAttemptAt: restoreStatus === QueueStatus.FAILED ? now : null,
        ...clearClaimFields(),
      },
      include: {
        contact: { select: { id: true, name: true, mobile: true } },
        template: { select: { id: true, name: true } },
      },
    });

    return {
      queueId,
      status: "skipped",
      queue: serializeQueueItem(updated),
      error: "Organization is inactive",
      errorCode: "ORGANIZATION_INACTIVE",
    };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { status: true },
  });

  if (subscription) {
    try {
      assertSubscriptionAllowsSending(subscription);
    } catch (error) {
      if (error instanceof SubscriptionBlockedError) {
        const restoreStatus =
          queue.attemptCount === 0 ? QueueStatus.PENDING : QueueStatus.FAILED;
        const updated = await prisma.sendQueue.update({
          where: { id: queue.id },
          data: {
            status: restoreStatus,
            nextAttemptAt: restoreStatus === QueueStatus.FAILED ? now : null,
            lastErrorCode: error.code,
            lastError: error.message,
            ...clearClaimFields(),
          },
          include: {
            contact: { select: { id: true, name: true, mobile: true } },
            template: { select: { id: true, name: true } },
          },
        });

        return {
          queueId,
          status: "skipped",
          queue: serializeQueueItem(updated),
          error: error.message,
          errorCode: error.code,
        };
      }
      throw error;
    }
  }

  if (isAutomationOriginatedIdempotencyKey(queue.idempotencyKey)) {
    const automationSchedule = await resolveAutomationSendSchedule(
      organizationId,
      queue,
    );

    if (
      automationSchedule.sendHour === null ||
      automationSchedule.sendMinute === null
    ) {
      const updated = await prisma.sendQueue.update({
        where: { id: queue.id },
        data: {
          status: QueueStatus.PENDING,
          nextAttemptAt: new Date(now.getTime() + 60 * 60 * 1000),
          lastErrorCode: "AUTOMATION_SEND_TIME_NOT_SET",
          lastError:
            automationSchedule.source === "category"
              ? "Category automatic send time is not set. Choose a time under Automatic Greetings."
              : "Automatic send time is not set. Choose a time under Automatic Greetings.",
          ...clearClaimFields(),
        },
        include: {
          contact: { select: { id: true, name: true, mobile: true } },
          template: { select: { id: true, name: true } },
        },
      });

      return {
        queueId,
        status: "skipped" as const,
        queue: serializeQueueItem(updated),
        error: "Automatic send time is not set",
        errorCode: "AUTOMATION_SEND_TIME_NOT_SET",
      };
    }

    if (
      !isAtOrAfterAutomationSendTime(
        automationSchedule.sendHour,
        automationSchedule.sendMinute,
        now,
      )
    ) {
      const nextAttemptAt = getAutomationSendInstant(
        automationSchedule.sendHour,
        automationSchedule.sendMinute,
        now,
      );
      const updated = await prisma.sendQueue.update({
        where: { id: queue.id },
        data: {
          status: QueueStatus.PENDING,
          nextAttemptAt,
          lastErrorCode: "BEFORE_AUTOMATION_SEND_TIME",
          lastError:
            "Waiting until the organization's configured automatic send time (IST)",
          ...clearClaimFields(),
        },
        include: {
          contact: { select: { id: true, name: true, mobile: true } },
          template: { select: { id: true, name: true } },
        },
      });

      return {
        queueId,
        status: "skipped",
        queue: serializeQueueItem(updated),
        error: updated.lastError ?? undefined,
        errorCode: "BEFORE_AUTOMATION_SEND_TIME",
      };
    }
  }

  if (queue.contact && !queue.contact.isActive) {
    return finalizeSkippedInactive(organizationId, queue.id);
  }

  const channelConfig = await getEffectiveChannelConfig(
    organizationId,
    queue.channel,
  );

  const attemptNumber = queue.attemptCount + 1;
  let providerName: ChannelProvider | string =
    channelConfig?.provider ?? ChannelProvider.TEST;

  try {
    const provider = getMessageProvider(channelConfig, queue.channel);
    providerName = provider.name;

    if (
      queue.channel === Channel.SMS &&
      providerName === ChannelProvider.CUSTOM_HTTP
    ) {
      try {
        assertTemplateReadyForCustomHttpSend(queue.template, {
          renderedBody: queue.renderedBody,
          variableValues: { name: queueRecipientName(queue) },
        });
      } catch (error) {
        if (error instanceof TemplateValidationError) {
          throw new ProviderSendError(error.message, "TEMPLATE_NOT_READY");
        }

        throw error;
      }
    }

    let whatsappSnapshots:
      | ReturnType<typeof assertWhatsAppQueueSnapshots>
      | undefined;

    if (queue.channel === Channel.WHATSAPP) {
      try {
        whatsappSnapshots = assertWhatsAppQueueSnapshots(queue);
      } catch (error) {
        if (error instanceof QueueValidationError) {
          throw new ProviderSendError(error.message, "INVALID_BODY");
        }

        throw error;
      }
    }

    // Throttle before marking provider attempt so velocity never burns attempts.
    try {
      await assertAndRecordSendVelocity(organizationId);
    } catch (error) {
      if (error instanceof SendVelocityError) {
        return deferForSendVelocity(
          organizationId,
          queue,
          error.message,
          now,
        );
      }
      throw error;
    }

    const marked = await markProviderAttemptStarted(
      organizationId,
      queue.id,
      now,
    );

    if (!marked) {
      return {
        queueId,
        status: "skipped",
        error: "Queue item is no longer claimed for sending",
      };
    }

    let providerResult: {
      providerMessageId: string;
      units?: number;
    };

    try {
      if (queue.channel === Channel.WHATSAPP && whatsappSnapshots) {
        // Reuses the existing GeneratedDocument service, same choke point
        // as Email - never touches B2 or regenerates the PDF here. A
        // personalized document takes priority over the existing
        // image/video whatsappMediaAsset for the provider's single `file`
        // field; falls back to the existing media when no PDF is configured.
        const documentAttachment = await resolveWhatsAppPdfAttachment(
          organizationId,
          {
            generatedDocumentId: queue.generatedDocumentId,
            includePersonalizedPdf: queue.template.includePersonalizedPdf,
          },
          { storage: options.storage },
        );

        const media =
          documentAttachment ??
          (queue.whatsappMediaAsset
            ? {
                bytes: Buffer.from(queue.whatsappMediaAsset.bytes),
                filename: queue.whatsappMediaAsset.filename,
                contentType: queue.whatsappMediaAsset.contentType,
              }
            : undefined);

        console.info("WhatsApp provider request", {
          queueId: queue.id,
          idempotencyKey: queue.idempotencyKey,
          contactId: queue.contactId,
          recipient: maskRecipientForLog(queueRecipientMobile(queue)),
          templateName: whatsappSnapshots.templateName,
          language: whatsappSnapshots.language,
          parameterCount: whatsappSnapshots.parameterValues.length,
          documentId: queue.generatedDocumentId,
          hasPdf: Boolean(media),
        });

        providerResult = await provider.send({
          channel: Channel.WHATSAPP,
          recipient: queueRecipientMobile(queue),
          templateName: whatsappSnapshots.templateName,
          language: whatsappSnapshots.language,
          parameterValues: whatsappSnapshots.parameterValues,
          renderedBody: queue.renderedBody,
          ...(media ? { media } : {}),
          idempotencyKey: queue.idempotencyKey,
          attemptNumber,
        });
      } else if (queue.channel === Channel.SMS) {
        providerResult = await provider.send({
          channel: Channel.SMS,
          recipient: queueRecipientMobile(queue),
          body: queue.renderedBody,
          idempotencyKey: queue.idempotencyKey,
          attemptNumber,
          dltTemplateId: queue.template.dltTemplateId,
        });
      } else if (queue.channel === Channel.EMAIL) {
        const email = queueRecipientEmail(queue)?.trim();
        if (!email) {
          throw new ProviderSendError(
            "Contact email is required",
            "INVALID_RECIPIENT",
          );
        }
        const subject = queue.emailSubject?.trim();
        if (!subject) {
          throw new ProviderSendError(
            "Email subject is required",
            "INVALID_BODY",
          );
        }

        // Reuses the existing GeneratedDocument service as the single
        // choke point for org-scoping/expiry/storage - never touches B2
        // or regenerates the PDF here. Returns null for templates that
        // don't require a personalized PDF, leaving that path unchanged.
        const attachment = await resolveEmailPdfAttachment(
          organizationId,
          {
            generatedDocumentId: queue.generatedDocumentId,
            includePersonalizedPdf: queue.template.includePersonalizedPdf,
          },
          { storage: options.storage },
        );

        providerResult = await provider.send({
          channel: Channel.EMAIL,
          recipient: email,
          subject,
          body: queue.renderedBody,
          idempotencyKey: queue.idempotencyKey,
          attemptNumber,
          ...(attachment ? { attachments: [attachment] } : {}),
        });
      } else {
        throw new ProviderSendError(
          "Unsupported messaging channel",
          "UNKNOWN_PROVIDER",
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof ProviderSendError
          ? error.message
          : "Message send failed";
      const errorCode =
        error instanceof ProviderSendError ? error.code : "SEND_FAILED";

      if (queue.channel === Channel.WHATSAPP) {
        // errorCode already encodes the HTTP outcome (PROVIDER_HTTP_4XX/5XX/
        // 429/etc, or a DOCUMENT_* retrieval failure) - errorMessage is
        // ProviderSendError's own message, already truncated/sanitized at
        // the provider layer and never includes the API key or credentials.
        console.error("WhatsApp delivery failed", {
          queueId: queue.id,
          contactId: queue.contactId,
          errorCode,
          error: errorMessage,
        });
      }

      return finalizeFailure(
        organizationId,
        queue,
        attemptNumber,
        providerName,
        errorMessage,
        errorCode,
        options.random,
      );
    }

    try {
      return await finalizeSuccess(
        organizationId,
        queue,
        attemptNumber,
        providerName,
        providerResult,
      );
    } catch {
      return finalizeFailure(
        organizationId,
        queue,
        attemptNumber,
        providerName,
        AMBIGUOUS_PROVIDER_OUTCOME_MESSAGE,
        "FINALIZE_FAILED_AFTER_PROVIDER_SUCCESS",
        options.random,
      );
    }
  } catch (error) {
    // Pre-send failures (before providerAttemptStartedAt): definite, not ambiguous.
    // Do not increment attemptCount - the provider was never reached.
    // lastErrorCode must not be worker-claimable (allowlist claim policy).
    const errorMessage =
      error instanceof ProviderSendError
        ? error.message
        : "Message send failed";
    const errorCode =
      error instanceof ProviderSendError ? error.code : "SEND_FAILED";

    const updated = await prisma.sendQueue.update({
      where: { id: queue.id },
      data: {
        status: QueueStatus.FAILED,
        lastError: errorMessage,
        lastErrorCode: errorCode,
        nextAttemptAt: null,
        ...clearClaimFields(),
      },
      include: {
        contact: { select: { id: true, name: true, mobile: true } },
        template: { select: { id: true, name: true } },
      },
    });

    return {
      queueId: queue.id,
      status: "failed",
      queue: serializeQueueItem(updated),
      error: errorMessage,
      errorCode,
    };
  }
}

/**
 * Claim a single eligible queue item by id (short transaction), then process it.
 * Used by tests and focused single-item processing - not by Manual Send / Birthday.
 */
export async function sendQueueItem(
  organizationId: string,
  queueId: string,
  mode: "send" | "retry" = "send",
  options: ProcessQueueItemOptions = {},
): Promise<SendQueueItemResult> {
  if (mode === "retry") {
    // Legacy sync retry path removed: schedule for workers instead.
    const scheduled = await scheduleQueueRetry(organizationId, queueId, {
      confirmAmbiguousRetry: true,
    });
    return {
      queueId,
      status: "skipped",
      queue: scheduled.queue,
      error: "Retry scheduled for background processing",
      errorCode: "RETRY_SCHEDULED",
    };
  }

  const now = options.now ?? new Date();
  const leaseExpiresAt = new Date(now.getTime() + QUEUE_LEASE_DURATION_MS);

  const claimed = await prisma.sendQueue.updateMany({
    where: {
      id: queueId,
      organizationId,
      status: QueueStatus.PENDING,
    },
    data: {
      status: QueueStatus.SENDING,
      claimedAt: now,
      leaseExpiresAt,
      providerAttemptStartedAt: null,
      nextAttemptAt: null,
    },
  });

  if (claimed.count === 0) {
    const current = await prisma.sendQueue.findFirst({
      where: { id: queueId, organizationId },
      select: { status: true },
    });

    if (!current) {
      throw new QueueNotFoundError();
    }

    return {
      queueId,
      status: "skipped",
      error:
        current.status === QueueStatus.SENDING
          ? "Queue item is already being processed"
          : "Queue item is not in a sendable state",
    };
  }

  return processClaimedQueueItem(organizationId, queueId, options);
}

export type ScheduleRetryResult = {
  queueId: string;
  status: "scheduled";
  queue: ReturnType<typeof serializeQueueItem>;
  warning?: string;
};

/**
 * Re-enable a FAILED queue row for worker delivery without calling the provider.
 */
export async function scheduleQueueRetry(
  organizationId: string,
  queueId: string,
  input: { confirmAmbiguousRetry?: boolean } = {},
  db: Pick<Prisma.TransactionClient, "sendQueue"> = prisma,
): Promise<ScheduleRetryResult> {
  const queue = await db.sendQueue.findFirst({
    where: { id: queueId, organizationId },
    include: {
      contact: { select: { id: true, name: true, mobile: true } },
      template: { select: { id: true, name: true } },
    },
  });

  if (!queue) {
    throw new QueueNotFoundError();
  }

  if (queue.status !== QueueStatus.FAILED) {
    throw new QueueInvalidStateError("Only failed queue items can be retried");
  }

  if (queue.attemptCount >= MAX_SEND_ATTEMPTS) {
    throw new QueueMaxAttemptsError();
  }

  const isAmbiguous = queue.lastErrorCode === AMBIGUOUS_PROVIDER_OUTCOME;

  if (isAmbiguous && input.confirmAmbiguousRetry !== true) {
    throw new QueueInvalidStateError(
      `${AMBIGUOUS_PROVIDER_OUTCOME_MESSAGE} Pass confirmAmbiguousRetry=true to acknowledge duplicate-send risk.`,
    );
  }

  const document = await ensureQueueDocumentForRetry(organizationId, queue.id);
  if (!document.ok) {
    throw new QueueInvalidStateError(
      `Could not prepare the personalized PDF for this delivery: ${document.message}`,
    );
  }

  const updated = await db.sendQueue.update({
    where: { id: queue.id },
    data: {
      status: QueueStatus.FAILED,
      nextAttemptAt: new Date(0),
      lastError: null,
      lastErrorCode: null,
      claimedAt: null,
      leaseExpiresAt: null,
      providerAttemptStartedAt: null,
    },
    include: {
      contact: { select: { id: true, name: true, mobile: true } },
      template: { select: { id: true, name: true } },
    },
  });

  return {
    queueId: queue.id,
    status: "scheduled",
    queue: serializeQueueItem(updated),
    warning: isAmbiguous ? AMBIGUOUS_PROVIDER_OUTCOME_MESSAGE : undefined,
  };
}

/** @deprecated Prefer scheduleQueueRetry - kept name for API compatibility. */
export async function retryQueueItem(
  organizationId: string,
  queueId: string,
  input: { confirmAmbiguousRetry?: boolean } = {},
) {
  return scheduleQueueRetry(organizationId, queueId, input);
}

export type BatchSendSummary = {
  requested: number;
  sent: number;
  failed: number;
  skipped: number;
  retryScheduled?: number;
  ambiguous?: number;
  results: SendQueueItemResult[];
};

/**
 * Process specific PENDING queue IDs for one tenant (claim + send).
 * Not used by Manual Send or Birthday Automation orchestration.
 */
export async function sendQueueItems(
  organizationId: string,
  queueIds: string[],
  options: ProcessQueueItemOptions = {},
): Promise<BatchSendSummary> {
  const results: SendQueueItemResult[] = [];

  for (const queueId of queueIds) {
    try {
      const result = await sendQueueItem(
        organizationId,
        queueId,
        "send",
        options,
      );
      results.push(result);
    } catch (error) {
      if (error instanceof QueueNotFoundError) {
        results.push({
          queueId,
          status: "skipped",
          error: error.message,
        });
        continue;
      }

      throw error;
    }
  }

  return {
    requested: queueIds.length,
    sent: results.filter((result) => result.status === "sent").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    retryScheduled: results.filter((r) => r.status === "retry_scheduled")
      .length,
    ambiguous: results.filter((r) => r.status === "ambiguous").length,
    results,
  };
}
