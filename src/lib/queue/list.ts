import { prisma } from "@/lib/db";
import type { ListQueueQuery } from "@/lib/validation/queue";

import { buildQueueListWhere, serializeQueueItem } from "./serialize";

export async function listQueue(
  organizationId: string,
  query: ListQueueQuery,
) {
  const where = buildQueueListWhere(organizationId, query);

  const [total, items] = await prisma.$transaction([
    prisma.sendQueue.count({ where }),
    prisma.sendQueue.findMany({
      where,
      include: {
        contact: {
          select: { id: true, name: true, mobile: true },
        },
        template: {
          select: { id: true, name: true },
        },
        whatsappMediaAsset: {
          select: { filename: true },
        },
      },
      orderBy: [
        { scheduledDate: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    data: items.map(serializeQueueItem),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}
