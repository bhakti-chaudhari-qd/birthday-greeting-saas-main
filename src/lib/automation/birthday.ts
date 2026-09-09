import { validateEmailOccasionTemplate } from "@/lib/automation/category-settings";
import {
  AUTOMATION_TIMEZONE,
} from "@/lib/automation/constants";
import {
  validateSelectedBirthdayTemplate,
  validateSelectedWhatsAppBirthdayTemplate,
} from "@/lib/automation/settings";
import { runOccasionAutomationWithCategoryFallback } from "@/lib/automation/run-with-category-rules";
import {
  type OccasionAutomationOrganizationSummary,
  type OccasionAutomationSummary,
} from "@/lib/automation/run-occasion-automation";
import { prisma } from "@/lib/db";
import { generateBirthdayQueue } from "@/lib/queue/generate";
import { getOrganizationLocalIsoDate, parseTargetDate } from "@/lib/queue/dates";
import { Channel } from "@prisma/client";
import { OccasionType } from "./occasion-types";

export type BirthdayAutomationOrganizationSummary =
  OccasionAutomationOrganizationSummary;
export type BirthdayAutomationSummary = OccasionAutomationSummary;

function resolveAutomationTargetDate(referenceDate?: Date) {
  const isoDate = getOrganizationLocalIsoDate(
    AUTOMATION_TIMEZONE,
    referenceDate ?? new Date(),
  );
  return parseTargetDate(isoDate);
}

/**
 * Birthday Automation is generation-only. Workers deliver queued messages.
 * Uses per-category rules when configured; otherwise org-wide templates.
 */
export async function runBirthdayAutomation(
  referenceDate?: Date,
): Promise<BirthdayAutomationSummary> {
  const reference = referenceDate ?? new Date();
  const target = resolveAutomationTargetDate(reference);

  const organizations = await prisma.organization.findMany({
    where: {
      isActive: true,
      categoryAutomationRules: {
        some: {
          occasion: { name: "Birthday" },
          OR: [
            { smsEnabled: true, smsTemplateId: { not: null } },
            { whatsappEnabled: true, whatsappTemplateId: { not: null } },
            { emailEnabled: true, emailTemplateId: { not: null } },
          ],
        },
      },
    },
    orderBy: [{ id: "asc" }],
    select: {
      id: true,
    },
  });

  return runOccasionAutomationWithCategoryFallback({
    reference,
    targetDate: target.isoDate,
    occasionType: OccasionType.BIRTHDAY,
    organizations: organizations.map((organization) => ({
      id: organization.id,
    })),
    validateTemplate: (organizationId, templateId, channel) =>
      channel === Channel.WHATSAPP
        ? validateSelectedWhatsAppBirthdayTemplate(organizationId, templateId)
        : channel === Channel.EMAIL
          ? validateEmailOccasionTemplate(
              organizationId,
              templateId,
              OccasionType.BIRTHDAY,
            )
          : validateSelectedBirthdayTemplate(organizationId, templateId),
    generateQueue: (organizationId, templateId, targetDate, maxCreates) =>
      generateBirthdayQueue(
        organizationId,
        { templateId, targetDate },
        { maxCreates },
      ),
    generateQueueWithCategoryRules: (
      organizationId,
      templateId,
      targetDate,
      maxCreates,
      categoryRules,
      referenceDateForRules,
    ) =>
      generateBirthdayQueue(
        organizationId,
        { templateId, targetDate },
        {
          maxCreates,
          categoryRules,
          referenceDate: referenceDateForRules,
        },
      ),
  });
}
