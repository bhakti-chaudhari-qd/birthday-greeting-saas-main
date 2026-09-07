import { Channel } from "@prisma/client";

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
          OR: [
            { smsEnabled: true, smsTemplateId: { not: null } },
            { whatsappEnabled: true, whatsappTemplateId: { not: null } },
            { emailEnabled: true, emailTemplateId: { not: null } },
          ],
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
