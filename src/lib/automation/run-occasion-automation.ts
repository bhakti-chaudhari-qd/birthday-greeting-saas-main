import {
  Channel,
  type MessageTemplate,
} from "@prisma/client";

import { resolveAutomationCreatesPerRun } from "@/lib/automation/caps";
import type { ActiveCategoryChannelRule } from "@/lib/automation/category-settings";
import { listActiveCategoryChannelRules } from "@/lib/automation/category-settings";
import { prisma } from "@/lib/db";
import type { QueueGenerationSummary } from "@/lib/queue/generate";
import {
  assertTemplateEligibleForProviderSend,
  resolveSmsProviderMode,
} from "@/lib/queue/provider-send-eligibility";
import { assertWhatsAppTemplateEligibleForManualSend } from "@/lib/queue/whatsapp-send-eligibility";

export type OccasionAutomationOrganizationSummary = {
  organizationId: string;
  status:
    | "processed"
    | "skipped_ineligible"
    | "skipped_before_send_time"
    | "failed";
  generation?: QueueGenerationSummary;
  generations?: Array<QueueGenerationSummary & { channel: Channel }>;
  channelErrors?: Partial<Record<Channel, string>>;
  error?: string;
};

export type OccasionAutomationSummary = {
  targetDate: string;
  organizationsConsidered: number;
  organizationsProcessed: number;
  organizationsSkippedIneligible: number;
  organizationsSkippedBeforeSendTime: number;
  organizationsFailed: number;
  totalCreated: number;
  totalSkippedDuplicate: number;
  totalSkippedLimit: number;
  totalSkippedIneligible: number;
  totalUnprocessedByBound: number;
  processingIncomplete: boolean;
  organizations: OccasionAutomationOrganizationSummary[];
};

type GenerateWithRules = (
  organizationId: string,
  templateId: string,
  targetDate: string,
  maxCreates: number,
  categoryRules: ActiveCategoryChannelRule[],
  referenceDate: Date,
) => Promise<QueueGenerationSummary>;

function emptySummary(targetDate: string): OccasionAutomationSummary {
  return {
    targetDate,
    organizationsConsidered: 0,
    organizationsProcessed: 0,
    organizationsSkippedIneligible: 0,
    organizationsSkippedBeforeSendTime: 0,
    organizationsFailed: 0,
    totalCreated: 0,
    totalSkippedDuplicate: 0,
    totalSkippedLimit: 0,
    totalSkippedIneligible: 0,
    totalUnprocessedByBound: 0,
    processingIncomplete: false,
    organizations: [],
  };
}

async function assertChannelEligible(
  organizationId: string,
  channel: Channel,
  template: MessageTemplate,
) {
  if (channel === Channel.EMAIL) {
    if (!template.emailSubject?.trim()) {
      throw new Error("Email subject is required");
    }
    return;
  }

  const channelConfig = await prisma.channelConfig.findFirst({
    where: { organizationId, channel, isActive: true },
  });

  if (channel === Channel.WHATSAPP) {
    assertWhatsAppTemplateEligibleForManualSend(template, channelConfig);
    return;
  }

  const providerMode = resolveSmsProviderMode(channelConfig);
  assertTemplateEligibleForProviderSend(template, providerMode);
}

/**
 * Runs automation for one occasion across the given organizations, routing
 * each contact through its category-specific rule (or the categoryId=null
 * "all contacts" rule when the contact has no matching category rule) - see
 * listActiveCategoryChannelRules. Per-contact send-time gating happens
 * inside generateQueueWithCategoryRules (each rule can have its own time).
 */
export async function runOccasionAutomation(input: {
  reference: Date;
  targetDate: string;
  occasionId: string;
  organizations: Array<{ id: string }>;
  validateTemplate: (
    organizationId: string,
    templateId: string,
    channel: Channel,
  ) => Promise<MessageTemplate>;
  generateQueueWithCategoryRules: GenerateWithRules;
}): Promise<OccasionAutomationSummary> {
  const summary = emptySummary(input.targetDate);
  summary.organizationsConsidered = input.organizations.length;

  for (const organization of input.organizations) {
    const organizationSummary: OccasionAutomationSummary["organizations"][number] =
      {
        organizationId: organization.id,
        status: "processed",
        generations: [],
        channelErrors: {},
      };

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: organization.id },
      select: { contactLimit: true },
    });
    let remainingCreates = resolveAutomationCreatesPerRun(
      subscription?.contactLimit ?? 500,
    );

    let processedChannels = 0;
    let failedChannels = 0;

    for (const channel of [Channel.SMS, Channel.WHATSAPP, Channel.EMAIL] as const) {
      const rules = await listActiveCategoryChannelRules(
        organization.id,
        input.occasionId,
        channel,
      );
      if (rules.length === 0) {
        continue;
      }

      try {
        for (const rule of rules) {
          const template = await input.validateTemplate(
            organization.id,
            rule.templateId,
            channel,
          );
          await assertChannelEligible(organization.id, channel, template);
        }

        const generation = await input.generateQueueWithCategoryRules(
          organization.id,
          rules[0]!.templateId,
          input.targetDate,
          remainingCreates,
          rules,
          input.reference,
        );

        organizationSummary.generations!.push({
          ...generation,
          channel,
        });
        if (!organizationSummary.generation || channel === Channel.SMS) {
          organizationSummary.generation = generation;
        }

        summary.totalCreated += generation.created;
        summary.totalSkippedDuplicate += generation.skippedDuplicate;
        summary.totalSkippedLimit += generation.skippedLimit;
        summary.totalSkippedIneligible += generation.skippedIneligible;
        summary.totalUnprocessedByBound += generation.unprocessedByBound;
        summary.processingIncomplete ||= generation.generationIncomplete;
        remainingCreates = Math.max(0, remainingCreates - generation.created);
        processedChannels += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Channel processing failed";
        organizationSummary.channelErrors![channel] = message;
        failedChannels += 1;
      }
    }

    if (processedChannels > 0) {
      summary.organizationsProcessed += 1;
      if (failedChannels > 0) {
        summary.processingIncomplete = true;
      }
    } else if (failedChannels > 0) {
      organizationSummary.status = "skipped_ineligible";
      organizationSummary.error = Object.values(
        organizationSummary.channelErrors ?? {},
      ).join("; ");
      summary.organizationsSkippedIneligible += 1;
    } else {
      organizationSummary.status = "failed";
      organizationSummary.error =
        "No enabled automation channel has a template";
      summary.organizationsFailed += 1;
      summary.processingIncomplete = true;
    }

    summary.organizations.push(organizationSummary);
  }

  return summary;
}
