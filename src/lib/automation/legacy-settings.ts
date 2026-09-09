import { prisma } from "@/lib/db";

export type LegacyOccasionSettings = {
  occasionId: string;
  smsEnabled: boolean;
  smsTemplateId: string | null;
  whatsappEnabled: boolean;
  whatsappTemplateId: string | null;
  sendHour: number | null;
  sendMinute: number | null;
};

export async function loadLegacyOccasionSettings(
  organizationId: string,
  occasionName: string,
): Promise<LegacyOccasionSettings | null> {
  const occasion = await prisma.occasion.findFirst({
    where: { organizationId, name: occasionName },
    select: { id: true },
  });
  if (!occasion) return null;

  const rule = await prisma.categoryAutomationRule.findFirst({
    where: { organizationId, occasionId: occasion.id, categoryId: null },
    select: {
      smsEnabled: true,
      smsTemplateId: true,
      whatsappEnabled: true,
      whatsappTemplateId: true,
      sendHour: true,
      sendMinute: true,
    },
  });

  return {
    occasionId: occasion.id,
    smsEnabled: rule?.smsEnabled ?? false,
    smsTemplateId: rule?.smsTemplateId ?? null,
    whatsappEnabled: rule?.whatsappEnabled ?? false,
    whatsappTemplateId: rule?.whatsappTemplateId ?? null,
    sendHour: rule?.sendHour ?? null,
    sendMinute: rule?.sendMinute ?? null,
  };
}

export async function updateLegacyOccasionSettings(
  organizationId: string,
  settings: LegacyOccasionSettings,
) {
  const existing = await prisma.categoryAutomationRule.findFirst({
    where: {
      organizationId,
      occasionId: settings.occasionId,
      categoryId: null,
    },
    select: { id: true },
  });
  const data = {
      sendHour: settings.sendHour,
      sendMinute: settings.sendMinute,
      smsEnabled: settings.smsEnabled,
      smsTemplateId: settings.smsTemplateId,
      whatsappEnabled: settings.whatsappEnabled,
      whatsappTemplateId: settings.whatsappTemplateId,
  };
  if (existing) {
    await prisma.categoryAutomationRule.update({ where: { id: existing.id }, data });
  } else {
    await prisma.categoryAutomationRule.create({
      data: {
        organizationId,
        occasionId: settings.occasionId,
        categoryId: null,
        ...data,
      },
    });
  }
}
