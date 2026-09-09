import { Channel, type MessageTemplate } from "@prisma/client";

import { prisma } from "@/lib/db";
import { buildAutomationScheduleDescription } from "@/lib/automation/send-time";
import {
  loadLegacyOccasionSettings,
  updateLegacyOccasionSettings,
} from "@/lib/automation/legacy-settings";
import { deriveRealSmsReadiness } from "@/lib/templates/readiness";
import type { UpdateCustomAutomationSettingsInput } from "@/lib/validation/custom-automation";

export class CustomAutomationSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomAutomationSettingsError";
  }
}

export type CustomAutomationTemplateOption = {
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

export type CustomAutomationSettingsView = {
  customAutoSendEnabled: boolean;
  customTemplateId: string | null;
  whatsappCustomAutoSendEnabled: boolean;
  whatsappCustomTemplateId: string | null;
  automationSendHour: number | null;
  automationSendMinute: number | null;
  scheduleDescription: string;
  eligibleTemplates: CustomAutomationTemplateOption[];
  selectedTemplate: CustomAutomationTemplateOption | null;
  whatsappEligibleTemplates: WhatsAppAutomationTemplateOption[];
  whatsappSelectedTemplate: WhatsAppAutomationTemplateOption | null;
};

function serializeTemplateOption(
  template: MessageTemplate,
): CustomAutomationTemplateOption {
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

async function listEligibleCustomTemplates(
  organizationId: string,
  channel: Channel,
) {
  return prisma.messageTemplate.findMany({
    where: {
      organizationId,
      isActive: true,
      occasion: { name: { notIn: ["Birthday", "Anniversary"] } },
      channel,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

export async function validateSelectedCustomTemplate(
  organizationId: string,
  templateId: string,
) {
  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, organizationId },
    include: { occasion: { select: { name: true } } },
  });

  if (!template) {
    throw new CustomAutomationSettingsError("Custom template not found");
  }

  if (!template.isActive) {
    throw new CustomAutomationSettingsError("Custom template is inactive");
  }

  if (template.occasion?.name === "Birthday" || template.occasion?.name === "Anniversary") {
    throw new CustomAutomationSettingsError(
      "Selected template must be a CUSTOM template",
    );
  }

  if (template.channel !== Channel.SMS) {
    throw new CustomAutomationSettingsError(
      "Selected template must be an SMS template",
    );
  }

  return template;
}

export async function validateSelectedWhatsAppCustomTemplate(
  organizationId: string,
  templateId: string,
) {
  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, organizationId },
    include: { occasion: { select: { name: true } } },
  });

  if (!template) {
    throw new CustomAutomationSettingsError("Custom template not found");
  }
  if (!template.isActive) {
    throw new CustomAutomationSettingsError("Custom template is inactive");
  }
  if (template.occasion?.name === "Birthday" || template.occasion?.name === "Anniversary") {
    throw new CustomAutomationSettingsError(
      "Selected template must be a CUSTOM template",
    );
  }
  if (template.channel !== Channel.WHATSAPP) {
    throw new CustomAutomationSettingsError(
      "Selected template must be a WhatsApp template",
    );
  }

  return template;
}

export async function getCustomAutomationSettings(
  organizationId: string,
): Promise<CustomAutomationSettingsView> {
  const [organizationRecord, legacy, eligibleTemplates, whatsappEligibleTemplates] =
    await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    }),
      loadLegacyOccasionSettings(organizationId, "Custom"),
      listEligibleCustomTemplates(organizationId, Channel.SMS),
      listEligibleCustomTemplates(organizationId, Channel.WHATSAPP),
  ]);

  if (!organizationRecord || !legacy) {
    throw new CustomAutomationSettingsError("Organization not found");
  }
  const organization = {
    customAutoSendEnabled: legacy.smsEnabled,
    customTemplateId: legacy.smsTemplateId,
    whatsappCustomAutoSendEnabled: legacy.whatsappEnabled,
    whatsappCustomTemplateId: legacy.whatsappTemplateId,
    automationSendHour: legacy.sendHour,
    automationSendMinute: legacy.sendMinute,
  };

  const selectedTemplate = organization.customTemplateId
    ? (eligibleTemplates.find(
        (template) => template.id === organization.customTemplateId,
      ) ??
      (await prisma.messageTemplate.findFirst({
        where: {
          id: organization.customTemplateId,
          organizationId,
        },
      })))
    : null;
  const whatsappSelectedTemplate = organization.whatsappCustomTemplateId
    ? (whatsappEligibleTemplates.find(
        (template) => template.id === organization.whatsappCustomTemplateId,
      ) ??
      (await prisma.messageTemplate.findFirst({
        where: {
          id: organization.whatsappCustomTemplateId,
          organizationId,
        },
      })))
    : null;

  return {
    customAutoSendEnabled: organization.customAutoSendEnabled,
    customTemplateId: organization.customTemplateId,
    whatsappCustomAutoSendEnabled:
      organization.whatsappCustomAutoSendEnabled,
    whatsappCustomTemplateId: organization.whatsappCustomTemplateId,
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

export async function updateCustomAutomationSettings(
  organizationId: string,
  input: UpdateCustomAutomationSettingsInput,
) {
  const [existingRecord, legacy] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    }),
    loadLegacyOccasionSettings(organizationId, "Custom"),
  ]);

  if (!existingRecord || !legacy) {
    throw new CustomAutomationSettingsError("Organization not found");
  }
  const existing = {
    customAutoSendEnabled: legacy.smsEnabled,
    customTemplateId: legacy.smsTemplateId,
    whatsappCustomAutoSendEnabled: legacy.whatsappEnabled,
    whatsappCustomTemplateId: legacy.whatsappTemplateId,
    automationSendHour: legacy.sendHour,
    automationSendMinute: legacy.sendMinute,
  };

  const nextAutoSendEnabled =
    input.customAutoSendEnabled ?? existing.customAutoSendEnabled;
  const nextCustomTemplateId =
    input.customTemplateId !== undefined
      ? input.customTemplateId
      : existing.customTemplateId;
  const nextWhatsAppAutoSendEnabled =
    input.whatsappCustomAutoSendEnabled ??
    existing.whatsappCustomAutoSendEnabled;
  const nextWhatsAppTemplateId =
    input.whatsappCustomTemplateId !== undefined
      ? input.whatsappCustomTemplateId
      : existing.whatsappCustomTemplateId;

  // Only validate templates for channels that are enabled. Disabled channels
  // may retain a stale ID after a template type change; rejecting those would
  // block saving other occasion settings from the shared settings page.
  if (nextAutoSendEnabled) {
    if (!nextCustomTemplateId) {
      throw new CustomAutomationSettingsError(
        "A custom template must be selected before enabling automation",
      );
    }
    await validateSelectedCustomTemplate(organizationId, nextCustomTemplateId);
  } else if (input.customTemplateId) {
    await validateSelectedCustomTemplate(organizationId, input.customTemplateId);
  }

  if (nextWhatsAppAutoSendEnabled) {
    if (!nextWhatsAppTemplateId) {
      throw new CustomAutomationSettingsError(
        "A WhatsApp custom template must be selected before enabling automation",
      );
    }
    await validateSelectedWhatsAppCustomTemplate(
      organizationId,
      nextWhatsAppTemplateId,
    );
  } else if (input.whatsappCustomTemplateId) {
    await validateSelectedWhatsAppCustomTemplate(
      organizationId,
      input.whatsappCustomTemplateId,
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
    smsTemplateId: nextCustomTemplateId,
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

  return getCustomAutomationSettings(organizationId);
}
