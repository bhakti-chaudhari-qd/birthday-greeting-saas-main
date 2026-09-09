import { Channel, type MessageTemplate } from "@prisma/client";

import { prisma } from "@/lib/db";
import { buildAutomationScheduleDescription } from "@/lib/automation/send-time";
import {
  loadLegacyOccasionSettings,
  updateLegacyOccasionSettings,
} from "@/lib/automation/legacy-settings";
import { deriveRealSmsReadiness } from "@/lib/templates/readiness";
import type { UpdateBirthdayAutomationSettingsInput } from "@/lib/validation/birthday-automation";

export class BirthdayAutomationSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BirthdayAutomationSettingsError";
  }
}

export type BirthdayAutomationTemplateOption = {
  id: string;
  name: string;
  realSmsReady: boolean;
  realSmsStatusLabel: string;
};

export type WhatsAppAutomationTemplateOption = {
  id: string;
  name: string;
  readinessLabel: string;
};

export type BirthdayAutomationSettingsView = {
  autoSendEnabled: boolean;
  birthdayTemplateId: string | null;
  whatsappAutoSendEnabled: boolean;
  whatsappBirthdayTemplateId: string | null;
  automationSendHour: number | null;
  automationSendMinute: number | null;
  scheduleDescription: string;
  eligibleTemplates: BirthdayAutomationTemplateOption[];
  selectedTemplate: BirthdayAutomationTemplateOption | null;
  whatsappEligibleTemplates: WhatsAppAutomationTemplateOption[];
  whatsappSelectedTemplate: WhatsAppAutomationTemplateOption | null;
};

function serializeTemplateOption(
  template: MessageTemplate,
): BirthdayAutomationTemplateOption {
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
  return {
    id: template.id,
    name: template.name,
    readinessLabel: "WhatsApp ready",
  };
}

async function listEligibleBirthdayTemplates(
  organizationId: string,
  channel: Channel,
) {
  return prisma.messageTemplate.findMany({
    where: {
      organizationId,
      isActive: true,
      occasion: { name: "Birthday" },
      channel,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

async function validateSelectedBirthdayTemplate(
  organizationId: string,
  templateId: string,
) {
  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, organizationId },
    include: { occasion: { select: { name: true } } },
  });

  if (!template) {
    throw new BirthdayAutomationSettingsError("Birthday template not found");
  }

  if (!template.isActive) {
    throw new BirthdayAutomationSettingsError("Birthday template is inactive");
  }

  if (template.occasion?.name !== "Birthday") {
    throw new BirthdayAutomationSettingsError(
      "Selected template must be a BIRTHDAY template",
    );
  }

  if (template.channel !== Channel.SMS) {
    throw new BirthdayAutomationSettingsError(
      "Selected template must be an SMS template",
    );
  }

  return template;
}

export async function validateSelectedWhatsAppBirthdayTemplate(
  organizationId: string,
  templateId: string,
) {
  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, organizationId },
    include: { occasion: { select: { name: true } } },
  });

  if (!template) {
    throw new BirthdayAutomationSettingsError("Birthday template not found");
  }
  if (!template.isActive) {
    throw new BirthdayAutomationSettingsError("Birthday template is inactive");
  }
  if (template.occasion?.name !== "Birthday") {
    throw new BirthdayAutomationSettingsError(
      "Selected template must be a BIRTHDAY template",
    );
  }
  if (template.channel !== Channel.WHATSAPP) {
    throw new BirthdayAutomationSettingsError(
      "Selected template must be a WhatsApp template",
    );
  }

  return template;
}

export async function getBirthdayAutomationSettings(
  organizationId: string,
): Promise<BirthdayAutomationSettingsView> {
  const [organizationRecord, legacy, eligibleTemplates, whatsappEligibleTemplates] =
    await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    }),
      loadLegacyOccasionSettings(organizationId, "Birthday"),
      listEligibleBirthdayTemplates(organizationId, Channel.SMS),
      listEligibleBirthdayTemplates(organizationId, Channel.WHATSAPP),
  ]);

  if (!organizationRecord || !legacy) {
    throw new BirthdayAutomationSettingsError("Organization not found");
  }
  const organization = {
    autoSendEnabled: legacy.smsEnabled,
    birthdayTemplateId: legacy.smsTemplateId,
    whatsappAutoSendEnabled: legacy.whatsappEnabled,
    whatsappBirthdayTemplateId: legacy.whatsappTemplateId,
    automationSendHour: legacy.sendHour,
    automationSendMinute: legacy.sendMinute,
  };

  const selectedTemplate = organization.birthdayTemplateId
    ? (eligibleTemplates.find(
        (template) => template.id === organization.birthdayTemplateId,
      ) ??
      (await prisma.messageTemplate.findFirst({
        where: {
          id: organization.birthdayTemplateId,
          organizationId,
        },
      })))
    : null;
  const whatsappSelectedTemplate = organization.whatsappBirthdayTemplateId
    ? (whatsappEligibleTemplates.find(
        (template) => template.id === organization.whatsappBirthdayTemplateId,
      ) ??
      (await prisma.messageTemplate.findFirst({
        where: {
          id: organization.whatsappBirthdayTemplateId,
          organizationId,
        },
      })))
    : null;

  return {
    autoSendEnabled: organization.autoSendEnabled,
    birthdayTemplateId: organization.birthdayTemplateId,
    whatsappAutoSendEnabled: organization.whatsappAutoSendEnabled,
    whatsappBirthdayTemplateId: organization.whatsappBirthdayTemplateId,
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

export async function updateBirthdayAutomationSettings(
  organizationId: string,
  input: UpdateBirthdayAutomationSettingsInput,
) {
  const [existingRecord, legacy] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    }),
    loadLegacyOccasionSettings(organizationId, "Birthday"),
  ]);

  if (!existingRecord || !legacy) {
    throw new BirthdayAutomationSettingsError("Organization not found");
  }
  const existing = {
    autoSendEnabled: legacy.smsEnabled,
    birthdayTemplateId: legacy.smsTemplateId,
    whatsappAutoSendEnabled: legacy.whatsappEnabled,
    whatsappBirthdayTemplateId: legacy.whatsappTemplateId,
    automationSendHour: legacy.sendHour,
    automationSendMinute: legacy.sendMinute,
  };

  const nextAutoSendEnabled = input.autoSendEnabled ?? existing.autoSendEnabled;
  const nextBirthdayTemplateId =
    input.birthdayTemplateId !== undefined
      ? input.birthdayTemplateId
      : existing.birthdayTemplateId;
  const nextWhatsAppAutoSendEnabled =
    input.whatsappAutoSendEnabled ?? existing.whatsappAutoSendEnabled;
  const nextWhatsAppBirthdayTemplateId =
    input.whatsappBirthdayTemplateId !== undefined
      ? input.whatsappBirthdayTemplateId
      : existing.whatsappBirthdayTemplateId;

  // Only validate templates for channels that are enabled. Disabled channels
  // may retain a stale ID after a template type change; rejecting those would
  // block saving other occasion settings from the shared settings page.
  if (nextAutoSendEnabled) {
    if (!nextBirthdayTemplateId) {
      throw new BirthdayAutomationSettingsError(
        "A birthday template must be selected before enabling automation",
      );
    }
    await validateSelectedBirthdayTemplate(
      organizationId,
      nextBirthdayTemplateId,
    );
  } else if (input.birthdayTemplateId) {
    await validateSelectedBirthdayTemplate(
      organizationId,
      input.birthdayTemplateId,
    );
  }

  if (nextWhatsAppAutoSendEnabled) {
    if (!nextWhatsAppBirthdayTemplateId) {
      throw new BirthdayAutomationSettingsError(
        "A WhatsApp birthday template must be selected before enabling automation",
      );
    }
    await validateSelectedWhatsAppBirthdayTemplate(
      organizationId,
      nextWhatsAppBirthdayTemplateId,
    );
  } else if (input.whatsappBirthdayTemplateId) {
    await validateSelectedWhatsAppBirthdayTemplate(
      organizationId,
      input.whatsappBirthdayTemplateId,
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
    smsTemplateId: nextBirthdayTemplateId,
    whatsappEnabled: nextWhatsAppAutoSendEnabled,
    whatsappTemplateId: nextWhatsAppBirthdayTemplateId,
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

  return getBirthdayAutomationSettings(organizationId);
}

export { validateSelectedBirthdayTemplate };
