import { Channel, type MessageTemplate } from "@prisma/client";

import { prisma } from "@/lib/db";
import { buildAutomationScheduleDescription } from "@/lib/automation/send-time";
import { deriveRealSmsReadiness } from "@/lib/templates/readiness";
import {
  loadLegacyOccasionSettings,
  updateLegacyOccasionSettings,
} from "@/lib/automation/legacy-settings";
import type { UpdateAnniversaryAutomationSettingsInput } from "@/lib/validation/anniversary-automation";

export class AnniversaryAutomationSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnniversaryAutomationSettingsError";
  }
}

export type AnniversaryAutomationTemplateOption = {
  id: string;
  name: string;
  realSmsReady: boolean;
  realSmsStatusLabel: string;
};

type WhatsAppAutomationTemplateOption = {
  id: string;
  name: string;
  readinessLabel: string;
};

export type AnniversaryAutomationSettingsView = {
  anniversaryAutoSendEnabled: boolean;
  anniversaryTemplateId: string | null;
  whatsappAnniversaryAutoSendEnabled: boolean;
  whatsappAnniversaryTemplateId: string | null;
  automationSendHour: number | null;
  automationSendMinute: number | null;
  scheduleDescription: string;
  eligibleTemplates: AnniversaryAutomationTemplateOption[];
  selectedTemplate: AnniversaryAutomationTemplateOption | null;
  whatsappEligibleTemplates: WhatsAppAutomationTemplateOption[];
  whatsappSelectedTemplate: WhatsAppAutomationTemplateOption | null;
};

function serializeTemplateOption(
  template: MessageTemplate,
): AnniversaryAutomationTemplateOption {
  const readiness = deriveRealSmsReadiness(template);

  return {
    id: template.id,
    name: template.name,
    realSmsReady: readiness.realSmsReady,
    realSmsStatusLabel: readiness.realSmsStatusLabel,
  };
}

function serializeWhatsAppTemplateOption(
  template: MessageTemplate,
): WhatsAppAutomationTemplateOption {
  return { id: template.id, name: template.name, readinessLabel: "WhatsApp ready" };
}

async function listEligibleAnniversaryTemplates(
  organizationId: string,
  channel: Channel,
) {
  return prisma.messageTemplate.findMany({
    where: {
      organizationId,
      isActive: true,
      occasion: { name: "Anniversary" },
      channel,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

export async function validateSelectedAnniversaryTemplate(
  organizationId: string,
  templateId: string,
) {
  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, organizationId },
    include: { occasion: { select: { name: true } } },
  });

  if (!template) {
    throw new AnniversaryAutomationSettingsError(
      "Anniversary template not found",
    );
  }

  if (!template.isActive) {
    throw new AnniversaryAutomationSettingsError(
      "Anniversary template is inactive",
    );
  }

  if (template.occasion?.name !== "Anniversary") {
    throw new AnniversaryAutomationSettingsError(
      "Selected template must be an ANNIVERSARY template",
    );
  }

  if (template.channel !== Channel.SMS) {
    throw new AnniversaryAutomationSettingsError(
      "Selected template must be an SMS template",
    );
  }

  return template;
}

export async function validateSelectedWhatsAppAnniversaryTemplate(
  organizationId: string,
  templateId: string,
) {
  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, organizationId },
    include: { occasion: { select: { name: true } } },
  });

  if (!template) {
    throw new AnniversaryAutomationSettingsError(
      "Anniversary template not found",
    );
  }
  if (!template.isActive) {
    throw new AnniversaryAutomationSettingsError(
      "Anniversary template is inactive",
    );
  }
  if (template.occasion?.name !== "Anniversary") {
    throw new AnniversaryAutomationSettingsError(
      "Selected template must be an ANNIVERSARY template",
    );
  }
  if (template.channel !== Channel.WHATSAPP) {
    throw new AnniversaryAutomationSettingsError(
      "Selected template must be a WhatsApp template",
    );
  }

  return template;
}

export async function getAnniversaryAutomationSettings(
  organizationId: string,
): Promise<AnniversaryAutomationSettingsView> {
  const [organizationRecord, legacy, eligibleTemplates, whatsappEligibleTemplates] =
    await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } }),
      loadLegacyOccasionSettings(organizationId, "Anniversary"),
      listEligibleAnniversaryTemplates(organizationId, Channel.SMS),
      listEligibleAnniversaryTemplates(organizationId, Channel.WHATSAPP),
  ]);

  if (!organizationRecord || !legacy) {
    throw new AnniversaryAutomationSettingsError("Organization not found");
  }
  const organization = {
    ...organizationRecord,
    anniversaryAutoSendEnabled: legacy.smsEnabled,
    anniversaryTemplateId: legacy.smsTemplateId,
    whatsappAnniversaryAutoSendEnabled: legacy.whatsappEnabled,
    whatsappAnniversaryTemplateId: legacy.whatsappTemplateId,
    automationSendHour: legacy.sendHour,
    automationSendMinute: legacy.sendMinute,
  };

  const selectedTemplate = organization.anniversaryTemplateId
    ? (eligibleTemplates.find(
        (template) => template.id === organization.anniversaryTemplateId,
      ) ??
      (await prisma.messageTemplate.findFirst({
        where: {
          id: organization.anniversaryTemplateId,
          organizationId,
        },
      })))
    : null;
  const whatsappSelectedTemplate =
    organization.whatsappAnniversaryTemplateId
      ? (whatsappEligibleTemplates.find(
          (template) =>
            template.id === organization.whatsappAnniversaryTemplateId,
        ) ??
        (await prisma.messageTemplate.findFirst({
          where: {
            id: organization.whatsappAnniversaryTemplateId,
            organizationId,
          },
        })))
      : null;

  return {
    anniversaryAutoSendEnabled: organization.anniversaryAutoSendEnabled,
    anniversaryTemplateId: organization.anniversaryTemplateId,
    whatsappAnniversaryAutoSendEnabled:
      organization.whatsappAnniversaryAutoSendEnabled,
    whatsappAnniversaryTemplateId:
      organization.whatsappAnniversaryTemplateId,
    automationSendHour: organization.automationSendHour,
    automationSendMinute: organization.automationSendMinute,
    scheduleDescription: buildAutomationScheduleDescription(
      organization.automationSendHour,
      organization.automationSendMinute,
    ),
    eligibleTemplates: eligibleTemplates.map(serializeTemplateOption),
    selectedTemplate: selectedTemplate
      ? serializeTemplateOption(selectedTemplate)
      : null,
    whatsappEligibleTemplates: whatsappEligibleTemplates.map(
      serializeWhatsAppTemplateOption,
    ),
    whatsappSelectedTemplate: whatsappSelectedTemplate
      ? serializeWhatsAppTemplateOption(whatsappSelectedTemplate)
      : null,
  };
}

export async function updateAnniversaryAutomationSettings(
  organizationId: string,
  input: UpdateAnniversaryAutomationSettingsInput,
) {
  const [existingRecord, legacy] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } }),
    loadLegacyOccasionSettings(organizationId, "Anniversary"),
  ]);

  if (!existingRecord || !legacy) {
    throw new AnniversaryAutomationSettingsError("Organization not found");
  }
  const existing = {
    ...existingRecord,
    anniversaryAutoSendEnabled: legacy.smsEnabled,
    anniversaryTemplateId: legacy.smsTemplateId,
    whatsappAnniversaryAutoSendEnabled: legacy.whatsappEnabled,
    whatsappAnniversaryTemplateId: legacy.whatsappTemplateId,
    automationSendHour: legacy.sendHour,
    automationSendMinute: legacy.sendMinute,
  };

  const nextAutoSendEnabled =
    input.anniversaryAutoSendEnabled ?? existing.anniversaryAutoSendEnabled;
  const nextAnniversaryTemplateId =
    input.anniversaryTemplateId !== undefined
      ? input.anniversaryTemplateId
      : existing.anniversaryTemplateId;
  const nextWhatsAppAutoSendEnabled =
    input.whatsappAnniversaryAutoSendEnabled ??
    existing.whatsappAnniversaryAutoSendEnabled;
  const nextWhatsAppTemplateId =
    input.whatsappAnniversaryTemplateId !== undefined
      ? input.whatsappAnniversaryTemplateId
      : existing.whatsappAnniversaryTemplateId;

  // Only validate templates for channels that are enabled. Disabled channels
  // may retain a stale ID after a template type change; rejecting those would
  // block saving other occasion settings from the shared settings page.
  if (nextAutoSendEnabled) {
    if (!nextAnniversaryTemplateId) {
      throw new AnniversaryAutomationSettingsError(
        "An anniversary template must be selected before enabling automation",
      );
    }
    await validateSelectedAnniversaryTemplate(
      organizationId,
      nextAnniversaryTemplateId,
    );
  } else if (input.anniversaryTemplateId) {
    await validateSelectedAnniversaryTemplate(
      organizationId,
      input.anniversaryTemplateId,
    );
  }

  if (nextWhatsAppAutoSendEnabled) {
    if (!nextWhatsAppTemplateId) {
      throw new AnniversaryAutomationSettingsError(
        "A WhatsApp anniversary template must be selected before enabling automation",
      );
    }
    await validateSelectedWhatsAppAnniversaryTemplate(
      organizationId,
      nextWhatsAppTemplateId,
    );
  } else if (input.whatsappAnniversaryTemplateId) {
    await validateSelectedWhatsAppAnniversaryTemplate(
      organizationId,
      input.whatsappAnniversaryTemplateId,
    );
  }

  const nextSendHour =
    input.automationSendHour !== undefined
      ? input.automationSendHour
      : existing.automationSendHour;
  const nextSendMinute =
    input.automationSendMinute !== undefined
      ? input.automationSendMinute
      : existing.automationSendMinute;
  const sendTimeChanged =
    nextSendHour !== existing.automationSendHour ||
    nextSendMinute !== existing.automationSendMinute;

  await updateLegacyOccasionSettings(organizationId, {
    occasionId: legacy.occasionId,
    smsEnabled: nextAutoSendEnabled,
    smsTemplateId: nextAnniversaryTemplateId,
    whatsappEnabled: nextWhatsAppAutoSendEnabled,
    whatsappTemplateId: nextWhatsAppTemplateId,
    sendHour: nextSendHour,
    sendMinute: nextSendMinute,
  });

  if (
    sendTimeChanged &&
    nextSendHour !== null &&
    nextSendMinute !== null
  ) {
    const { reschedulePendingAutomationQueueForSendTime } = await import(
      "@/lib/automation/reschedule-pending"
    );
    await reschedulePendingAutomationQueueForSendTime(
      organizationId,
      nextSendHour,
      nextSendMinute,
    );
  }

  return getAnniversaryAutomationSettings(organizationId);
}
