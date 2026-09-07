import { Channel, type MessageTemplate } from "@prisma/client";

import { prisma } from "@/lib/db";
import { shouldPersonalizeWhatsAppMedia } from "@/lib/media/greeting-video-filename";

/**
 * Resolve WhatsApp media for a queue row. App-generated greeting videos are
 * re-rendered with the contact's name; custom uploads stay shared.
 */
export async function resolveWhatsAppMediaAssetIdForSend(options: {
  organizationId: string;
  template: Pick<MessageTemplate, "channel" | "whatsappMediaAssetId">;
  contactId: string;
  contactName: string;
  occasionName: string;
}): Promise<string | null> {
  if (options.template.channel !== Channel.WHATSAPP) {
    return null;
  }

  const templateMediaId = options.template.whatsappMediaAssetId;
  if (!templateMediaId) {
    return null;
  }

  const asset = await prisma.whatsAppMediaAsset.findFirst({
    where: { id: templateMediaId, organizationId: options.organizationId },
    select: { id: true, filename: true },
  });

  if (!asset) {
    return null;
  }

  if (!shouldPersonalizeWhatsAppMedia(asset.filename)) {
    return asset.id;
  }

  // Dynamic import keeps native canvas/ffmpeg out of the route module graph
  // until personalization is actually needed.
  const { createPersonalizedGreetingMediaAsset } = await import(
    "@/lib/media/personalized-greeting-video"
  );

  const personalized = await createPersonalizedGreetingMediaAsset(
    options.organizationId,
    {
      occasionName: options.occasionName,
      recipientName: options.contactName,
      contactId: options.contactId,
    },
  );

  return personalized.id;
}
