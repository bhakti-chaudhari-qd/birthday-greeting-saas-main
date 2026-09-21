import { Channel } from "@prisma/client";
import type { OccasionType as OccasionTypeValue } from "./occasion-types";

import {
  listActiveCategoryChannelRules,
  organizationHasActiveCategoryRules,
} from "@/lib/automation/category-settings";
import { resolveAutomationCreatesPerRun } from "@/lib/automation/caps";
import {
  runOccasionAutomation,
  type AutomationOrganizationInput,
  type OccasionAutomationSummary,
} from "@/lib/automation/run-occasion-automation";
import { getEffectiveChannelConfig } from "@/lib/channel-config/platform-defaults";
import { prisma } from "@/lib/db";
import type { QueueGenerationSummary } from "@/lib/queue/generate";
import {
  assertTemplateEligibleForProviderSend,
  resolveSmsProviderMode,
} from "@/lib/queue/provider-send-eligibility";
import { assertWhatsAppTemplateEligibleForManualSend } from "@/lib/queue/whatsapp-send-eligibility";
import type { MessageTemplate } from "@prisma/client";

type GenerateWithRules = (
  organizationId: string,
  templateId: string,
  targetDate: string,
  maxCreates: number,
  categoryRules: Awaited<ReturnType<typeof listActiveCategoryChannelRules>>,
  referenceDate: Date,
) => Promise<QueueGenerationSummary>;

/**
 * When category rules exist for the occasion, run per-category routing
 * (send time + template per category). Otherwise use org-wide defaults.
 */
export async function runOccasionAutomationWithCategoryFallback(input: {
  reference: Date;
  targetDate: string;
  occasionType: OccasionTypeValue;
  organizations: AutomationOrganizationInput[];
  validateTemplate: (
    organizationId: string,
    templateId: string,
    channel: Channel,
  ) => Promise<MessageTemplate>;
  generateQueue: (
    organizationId: string,
    templateId: string,
    targetDate: string,
    maxCreates: number,
  ) => Promise<QueueGenerationSummary>;
  generateQueueWithCategoryRules: GenerateWithRules;
}): Promise<OccasionAutomationSummary> {
  const categoryOrgs: AutomationOrganizationInput[] = [];
  const legacyOrgs: AutomationOrganizationInput[] = [];

  for (const organization of input.organizations) {
    const hasRules = await organizationHasActiveCategoryRules(
      organization.id,
      input.occasionType,
    );
    if (hasRules) {
      categoryOrgs.push(organization);
    } else {
      legacyOrgs.push(organization);
    }
  }

  const legacySummary =
    legacyOrgs.length > 0
      ? await runOccasionAutomation({
          reference: input.reference,
          targetDate: input.targetDate,
          occasionId: input.occasionType,
          organizations: legacyOrgs,
          validateTemplate: input.validateTemplate,
          generateQueue: input.generateQueue,
          generateQueueWithCategoryRules: input.generateQueueWithCategoryRules,
        })
      : emptySummary(input.targetDate);

  if (categoryOrgs.length === 0) {
    return legacySummary;
  }

  const categorySummary = await runCategoryRoutedAutomation({
    reference: input.reference,
    targetDate: input.targetDate,
    occasionType: input.occasionType,
    organizations: categoryOrgs,
    validateTemplate: input.validateTemplate,
    generateQueueWithCategoryRules: input.generateQueueWithCategoryRules,
  });

  return mergeSummaries(legacySummary, categorySummary);
}

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

function mergeSummaries(
  a: OccasionAutomationSummary,
  b: OccasionAutomationSummary,
): OccasionAutomationSummary {
  return {
    targetDate: a.targetDate || b.targetDate,
    organizationsConsidered:
      a.organizationsConsidered + b.organizationsConsidered,
    organizationsProcessed: a.organizationsProcessed + b.organizationsProcessed,
    organizationsSkippedIneligible:
      a.organizationsSkippedIneligible + b.organizationsSkippedIneligible,
    organizationsSkippedBeforeSendTime:
      a.organizationsSkippedBeforeSendTime +
      b.organizationsSkippedBeforeSendTime,
    organizationsFailed: a.organizationsFailed + b.organizationsFailed,
    totalCreated: a.totalCreated + b.totalCreated,
    totalSkippedDuplicate: a.totalSkippedDuplicate + b.totalSkippedDuplicate,
    totalSkippedLimit: a.totalSkippedLimit + b.totalSkippedLimit,
    totalSkippedIneligible:
      a.totalSkippedIneligible + b.totalSkippedIneligible,
    totalUnprocessedByBound:
      a.totalUnprocessedByBound + b.totalUnprocessedByBound,
    processingIncomplete: a.processingIncomplete || b.processingIncomplete,
    organizations: [...a.organizations, ...b.organizations],
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

  const channelConfig = await getEffectiveChannelConfig(organizationId, channel);

  if (channel === Channel.WHATSAPP) {
    assertWhatsAppTemplateEligibleForManualSend(template, channelConfig);
    return;
  }

  const providerMode = resolveSmsProviderMode(channelConfig);
  assertTemplateEligibleForProviderSend(template, providerMode);
}

async function runCategoryRoutedAutomation(input: {
  reference: Date;
  targetDate: string;
  occasionType: OccasionTypeValue;
  organizations: AutomationOrganizationInput[];
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
        input.occasionType,
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
        if (
          !organizationSummary.generation ||
          channel === Channel.SMS
        ) {
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
        "No enabled category automation channel has a template";
      summary.organizationsFailed += 1;
      summary.processingIncomplete = true;
    }

    summary.organizations.push(organizationSummary);
  }

  return summary;
}
