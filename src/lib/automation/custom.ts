import { Channel } from "@prisma/client";
import { OccasionType } from "./occasion-types";

import { validateEmailOccasionTemplate } from "@/lib/automation/category-settings";
import {
  AUTOMATION_TIMEZONE,
} from "@/lib/automation/constants";
import {
  validateSelectedCustomTemplate,
  validateSelectedWhatsAppCustomTemplate,
} from "@/lib/automation/custom-settings";
import { runOccasionAutomationWithCategoryFallback } from "@/lib/automation/run-with-category-rules";
import {
  type OccasionAutomationOrganizationSummary,
  type OccasionAutomationSummary,
} from "@/lib/automation/run-occasion-automation";
import { prisma } from "@/lib/db";
import { generateCustomQueue } from "@/lib/queue/generate";
import { getOrganizationLocalIsoDate, parseTargetDate } from "@/lib/queue/dates";

export type CustomAutomationOrganizationSummary =
  OccasionAutomationOrganizationSummary;
export type CustomAutomationSummary = OccasionAutomationSummary;

function resolveAutomationTargetDate(referenceDate?: Date) {
  const isoDate = getOrganizationLocalIsoDate(
    AUTOMATION_TIMEZONE,
    referenceDate ?? new Date(),
  );
  return parseTargetDate(isoDate);
}

/**
 * Custom occasion automation is generation-only. Workers deliver queued messages.
 * Uses per-category rules when configured; otherwise org-wide templates.
 */
export async function runCustomAutomation(
  referenceDate?: Date,
): Promise<CustomAutomationSummary> {
  const reference = referenceDate ?? new Date();
  const target = resolveAutomationTargetDate(reference);

  const organizations = await prisma.organization.findMany({
    where: {
      isActive: true,
      categoryAutomationRules: {
        some: {
          occasion: { name: { notIn: ["Birthday", "Anniversary"] } },
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
    occasionType: OccasionType.CUSTOM,
    organizations: organizations.map((organization) => ({
      id: organization.id,
    })),
    validateTemplate: (organizationId, templateId, channel) =>
      channel === Channel.WHATSAPP
        ? validateSelectedWhatsAppCustomTemplate(organizationId, templateId)
        : channel === Channel.EMAIL
          ? validateEmailOccasionTemplate(
              organizationId,
              templateId,
              OccasionType.CUSTOM,
            )
          : validateSelectedCustomTemplate(organizationId, templateId),
    generateQueue: (organizationId, templateId, targetDate, maxCreates) =>
      generateCustomQueue(
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
      generateCustomQueue(
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
