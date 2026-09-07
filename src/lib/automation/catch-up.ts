import { Channel } from "@prisma/client";

import {
  assertTemplateForRule,
  listActiveCategoryChannelRules,
  validateEmailOccasionTemplate,
} from "@/lib/automation/category-settings";
import { resolveAutomationCreatesPerRun } from "@/lib/automation/caps";
import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";
import { prisma } from "@/lib/db";
import { listOccasionOptions } from "@/lib/occasions/queries";
import {
  getOrganizationLocalIsoDate,
  getPreviousIsoDate,
  parseTargetDate,
} from "@/lib/queue/dates";
import { QueueValidationError } from "@/lib/queue/errors";
import { generateOccasionQueue, type QueueGenerationSummary } from "@/lib/queue/generate";

export type CatchUpChannelResult = {
  occasionId: string;
  occasionName: string;
  channel: Channel;
  created: number;
  skippedDuplicate: number;
  skippedLimit: number;
  skippedIneligible: number;
};

export type CatchUpSummary = {
  targetDate: string;
  created: number;
  skippedDuplicate: number;
  skippedLimit: number;
  skippedIneligible: number;
  channels: CatchUpChannelResult[];
};

const CHANNELS = [Channel.SMS, Channel.WHATSAPP, Channel.EMAIL] as const;

async function validateTemplate(
  organizationId: string,
  templateId: string,
  channel: Channel,
  occasionId: string,
) {
  if (channel === Channel.EMAIL) {
    return validateEmailOccasionTemplate(organizationId, templateId, occasionId);
  }
  return assertTemplateForRule(organizationId, templateId, channel, occasionId);
}

/**
 * Owner catch-up: queue greetings for every occasion on a past IST calendar
 * date (default: yesterday). Idempotent via existing queue keys. Routes
 * through each occasion's category rules (including the "all contacts" row).
 */
export async function catchUpMissedGreetings(
  organizationId: string,
  input: { targetDate?: string } = {},
): Promise<CatchUpSummary> {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true },
    select: { id: true },
  });

  if (!organization) {
    throw new QueueValidationError("Organization not found");
  }

  let targetDate: string;
  try {
    if (input.targetDate?.trim()) {
      targetDate = parseTargetDate(input.targetDate.trim()).isoDate;
    } else {
      const todayIst = getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE);
      targetDate = getPreviousIsoDate(todayIst);
    }
  } catch (error) {
    throw new QueueValidationError(
      error instanceof Error ? error.message : "Invalid target date",
    );
  }

  const todayIst = getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE);
  if (targetDate > todayIst) {
    throw new QueueValidationError(
      "Catch-up target date cannot be in the future (IST)",
    );
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { contactLimit: true },
  });
  let remainingCreates = resolveAutomationCreatesPerRun(
    subscription?.contactLimit ?? 500,
  );

  const summary: CatchUpSummary = {
    targetDate,
    created: 0,
    skippedDuplicate: 0,
    skippedLimit: 0,
    skippedIneligible: 0,
    channels: [],
  };

  const occasions = await listOccasionOptions(organizationId);

  for (const occasion of occasions) {
    for (const channel of CHANNELS) {
      if (remainingCreates <= 0) {
        break;
      }

      try {
        const rules = await listActiveCategoryChannelRules(
          organizationId,
          occasion.id,
          channel,
        );
        if (rules.length === 0) {
          continue;
        }
        for (const rule of rules) {
          await validateTemplate(
            organizationId,
            rule.templateId,
            channel,
            occasion.id,
          );
        }

        const generation: QueueGenerationSummary = await generateOccasionQueue(
          organizationId,
          occasion.id,
          { templateId: rules[0]!.templateId, targetDate },
          {
            maxCreates: remainingCreates,
            skipSendTimeGate: true,
            categoryRules: rules,
            referenceDate: new Date(),
          },
        );

        if (
          generation.created === 0 &&
          generation.skippedDuplicate === 0 &&
          generation.skippedLimit === 0 &&
          generation.skippedIneligible === 0 &&
          generation.eligible === 0
        ) {
          continue;
        }

        summary.channels.push({
          occasionId: occasion.id,
          occasionName: occasion.name,
          channel,
          created: generation.created,
          skippedDuplicate: generation.skippedDuplicate,
          skippedLimit: generation.skippedLimit,
          skippedIneligible: generation.skippedIneligible,
        });
        summary.created += generation.created;
        summary.skippedDuplicate += generation.skippedDuplicate;
        summary.skippedLimit += generation.skippedLimit;
        summary.skippedIneligible += generation.skippedIneligible;
        remainingCreates = Math.max(0, remainingCreates - generation.created);
      } catch {
        // Skip ineligible/misconfigured channels; other occasions still run.
        summary.channels.push({
          occasionId: occasion.id,
          occasionName: occasion.name,
          channel,
          created: 0,
          skippedDuplicate: 0,
          skippedLimit: 0,
          skippedIneligible: 0,
        });
      }
    }
  }

  // Drop empty channel stubs from failed validation paths with no activity.
  summary.channels = summary.channels.filter(
    (row) =>
      row.created > 0 ||
      row.skippedDuplicate > 0 ||
      row.skippedLimit > 0 ||
      row.skippedIneligible > 0,
  );

  return summary;
}
