import { prisma } from "@/lib/db";
import type { Locale } from "@/lib/i18n/constants";
import type { ExportDeliveriesQuery } from "@/lib/validation/send";

import {
  MAX_DELIVERY_EXPORT_ROWS,
  serializeDeliveriesToCsv,
} from "./csv";
import { buildDeliveryListWhere, serializeDeliveryLog } from "./list";

export async function exportDeliveriesCsv(
  organizationId: string,
  query: ExportDeliveriesQuery & {
    scheduledDateFrom?: string;
    scheduledDateTo?: string;
  },
  locale: Locale = "en",
): Promise<{ csv: string; total: number; truncated: boolean }> {
  const where = buildDeliveryListWhere(organizationId, query);

  const total = await prisma.deliveryLog.count({ where });

  const logs = await prisma.deliveryLog.findMany({
    where,
    include: {
      sendQueue: {
        select: {
          id: true,
          channel: true,
          status: true,
          renderedBody: true,
          whatsappMediaAssetId: true,
          occasionId: true,
          recipientName: true,
          recipientMobile: true,
          contact: { select: { name: true, mobile: true } },
          template: { select: { name: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_DELIVERY_EXPORT_ROWS,
  });

  return {
    csv: serializeDeliveriesToCsv(logs.map(serializeDeliveryLog), locale),
    total,
    truncated: total > MAX_DELIVERY_EXPORT_ROWS,
  };
}

export { MAX_DELIVERY_EXPORT_ROWS };
