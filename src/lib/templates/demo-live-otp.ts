import { Channel, type PrismaClient } from "@prisma/client";

import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";

/**
 * Demo-only live SMS template (Quickly Design OTP DLT).
 * Used so local demos can send Real SMS without re-entering Advanced SMS setup.
 * Override via env if the approved DLT text or ID changes.
 *
 * Not conceptually tied to any occasion (it's an OTP message) - attached to
 * the org's system Birthday occasion since it always exists.
 */
export const DEMO_LIVE_OTP_TEMPLATE_NAME = "Demo Live OTP";

export function getDemoLiveOtpTemplateContent() {
  const dltTemplateId =
    process.env.DEMO_SMS_DLT_TEMPLATE_ID?.trim() || "1707174533394491241";
  const dltApprovedContent =
    process.env.DEMO_SMS_DLT_APPROVED_CONTENT?.trim() ||
    "Dear User your {#var#} OTP for your Quickly Design application. https://www.quicklytech.in/ Valid for 10 mins QUICKLY DESIGN TECHNOLOGY PRIVATE LIMITED";
  const body =
    process.env.DEMO_SMS_BODY?.trim() ||
    "Dear User your {{name}} OTP for your Quickly Design application. https://www.quicklytech.in/ Valid for 10 mins QUICKLY DESIGN TECHNOLOGY PRIVATE LIMITED";

  return {
    name: DEMO_LIVE_OTP_TEMPLATE_NAME,
    channel: Channel.SMS,
    body,
    dltTemplateId,
    dltApprovedContent,
    isActive: true,
  };
}

/**
 * Upserts the demo OTP template for an organization (idempotent by name + org,
 * or by matching DLT template ID when an older demo template already exists).
 */
export async function ensureDemoLiveOtpTemplate(
  prisma: PrismaClient,
  organizationId: string,
) {
  const content = getDemoLiveOtpTemplateContent();
  const birthdayOccasion = await ensureSystemBirthdayOccasion(
    organizationId,
    prisma,
  );

  const existing =
    (await prisma.messageTemplate.findFirst({
      where: {
        organizationId,
        name: content.name,
        channel: Channel.SMS,
      },
    })) ??
    (await prisma.messageTemplate.findFirst({
      where: {
        organizationId,
        channel: Channel.SMS,
        dltTemplateId: content.dltTemplateId,
      },
    }));

  if (existing) {
    return prisma.messageTemplate.update({
      where: { id: existing.id },
      data: {
        name: content.name,
        occasionId: birthdayOccasion.id,
        body: content.body,
        dltTemplateId: content.dltTemplateId,
        dltApprovedContent: content.dltApprovedContent,
        isActive: true,
      },
    });
  }

  return prisma.messageTemplate.create({
    data: {
      organizationId,
      name: content.name,
      occasionId: birthdayOccasion.id,
      channel: content.channel,
      body: content.body,
      dltTemplateId: content.dltTemplateId,
      dltApprovedContent: content.dltApprovedContent,
      isActive: true,
    },
  });
}
