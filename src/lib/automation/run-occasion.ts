import { Channel, type Prisma } from "@prisma/client";

import {
  assertTemplateForRule,
  validateEmailOccasionTemplate,
} from "@/lib/automation/category-settings";
import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";
import {
  runOccasionAutomation as runOccasionAutomationEngine,
  type OccasionAutomationSummary,
} from "@/lib/automation/run-occasion-automation";
import { prisma } from "@/lib/db";
import { generateOccasionQueue } from "@/lib/queue/generate";
import { getOrganizationLocalIsoDate, parseTargetDate } from "@/lib/queue/dates";

function resolveAutomationTargetDate(referenceDate?: Date) {
  const isoDate = getOrganizationLocalIsoDate(
    AUTOMATION_TIMEZONE,
    referenceDate ?? new Date(),
  );
  return parseTargetDate(isoDate);
}

/** A rule that can actually queue something: a channel switched on with a template. */
const ENABLED_AUTOMATION_RULE_WHERE: Prisma.CategoryAutomationRuleWhereInput = {
  OR: [
    { smsEnabled: true, smsTemplateId: { not: null } },
    { whatsappEnabled: true, whatsappTemplateId: { not: null } },
    { emailEnabled: true, emailTemplateId: { not: null } },
    { callEnabled: true, callTemplateId: { not: null } },
  ],
};

/**
 * Occasions worth running automation for: active organization and at least
 * one enabled rule. Schedulers iterate this instead of every occasion row,
 * so an idle pass does not cost a round of queries per tenant.
 */
export async function listOccasionsWithEnabledAutomation() {
  return prisma.occasion.findMany({
    where: {
      organization: { isActive: true },
      automationRules: { some: ENABLED_AUTOMATION_RULE_WHERE },
    },
    orderBy: [{ organizationId: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
}

/**
 * Occasion automation is generation-only. Workers deliver queued messages.
 * Every organization's contacts route through category-specific rules (or
 * the categoryId=null "all contacts" rule) configured for this occasion -
 * the single entry point replacing the old per-occasion
 * runBirthdayAutomation/runAnniversaryAutomation/runCustomAutomation.
 */
export async function runOccasionAutomation(
  occasionId: string,
  referenceDate?: Date,
): Promise<OccasionAutomationSummary> {
  const reference = referenceDate ?? new Date();
  const target = resolveAutomationTargetDate(reference);

  const organizations = await prisma.organization.findMany({
    where: {
      isActive: true,
      categoryAutomationRules: {
        some: {
          occasionId,
          ...ENABLED_AUTOMATION_RULE_WHERE,
        },
      },
    },
    orderBy: [{ id: "asc" }],
    select: { id: true },
  });

  return runOccasionAutomationEngine({
    reference,
    targetDate: target.isoDate,
    occasionId,
    organizations,
    validateTemplate: (organizationId, templateId, channel) =>
      channel === Channel.EMAIL
        ? validateEmailOccasionTemplate(organizationId, templateId, occasionId)
        : assertTemplateForRule(organizationId, templateId, channel, occasionId),
    generateQueueWithCategoryRules: (
      organizationId,
      templateId,
      targetDate,
      maxCreates,
      categoryRules,
      referenceDateForRules,
    ) =>
      generateOccasionQueue(
        organizationId,
        occasionId,
        { templateId, targetDate },
        {
          maxCreates,
          categoryRules,
          referenceDate: referenceDateForRules,
        },
      ),
  });
}
