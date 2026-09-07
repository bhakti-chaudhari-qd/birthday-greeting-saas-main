import type { Prisma, SendQueue } from "@prisma/client";

import { previewTemplate } from "@/lib/templates/variables";

export function serializeQueueItem(
  item: SendQueue & {
    contact: { id: string; name: string; mobile: string } | null;
    template: { id: string; name: string };
    whatsappMediaAsset?: { filename: string } | null;
  },
) {
  return {
    id: item.id,
    contactId: item.contact?.id ?? item.contactId,
    contactName: item.contact?.name ?? item.recipientName,
    contactMobile: item.contact?.mobile ?? item.recipientMobile,
    templateId: item.template.id,
    templateName: item.template.name,
    channel: item.channel,
    occasionId: item.occasionId,
    scheduledDate: item.scheduledDate.toISOString().slice(0, 10),
    renderedBody: item.renderedBody,
    renderedPreview: previewTemplate(item.renderedBody),
    whatsappTemplateName: item.whatsappTemplateName ?? null,
    whatsappLanguage: item.whatsappLanguage ?? null,
    whatsappParameterValues: item.whatsappParameterValues ?? null,
    whatsappMediaAssetId: item.whatsappMediaAssetId ?? null,
    whatsappMediaPreviewUrl: item.whatsappMediaAssetId
      ? `/api/v1/whatsapp-media/${item.whatsappMediaAssetId}`
      : null,
    mediaFilename: item.whatsappMediaAsset?.filename ?? null,
    status: item.status,
    attemptCount: item.attemptCount,
    lastError: item.lastError,
    lastErrorCode: item.lastErrorCode ?? null,
    nextAttemptAt: item.nextAttemptAt?.toISOString() ?? null,
    sentAt: item.sentAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export type SerializedQueueItem = ReturnType<typeof serializeQueueItem>;

export function buildQueueListWhere(
  organizationId: string,
  query: {
    search?: string;
    status?: SendQueue["status"];
    channel?: SendQueue["channel"];
    occasionId?: SendQueue["occasionId"];
    categoryId?: string;
    scheduledDate?: string;
  },
): Prisma.SendQueueWhereInput {
  const where: Prisma.SendQueueWhereInput = { organizationId };

  if (query.status) {
    where.status = query.status;
  }

  if (query.channel) {
    where.channel = query.channel;
  }

  if (query.occasionId) {
    where.occasionId = query.occasionId;
  }

  if (query.scheduledDate) {
    where.scheduledDate = new Date(`${query.scheduledDate}T00:00:00.000Z`);
  }

  if (query.categoryId) {
    where.contact = {
      categoryId: query.categoryId,
    };
  }

  if (query.search) {
    where.OR = [
      { contact: { name: { contains: query.search, mode: "insensitive" } } },
      { contact: { mobile: { contains: query.search } } },
      { recipientName: { contains: query.search, mode: "insensitive" } },
      { recipientMobile: { contains: query.search } },
    ];
  }

  return where;
}
