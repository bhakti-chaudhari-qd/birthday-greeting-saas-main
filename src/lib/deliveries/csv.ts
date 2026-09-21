import { escapeCsvField } from "@/lib/contacts/csv";
import type { Locale } from "@/lib/i18n/constants";
import { getCsvHeaders } from "@/lib/i18n/dictionaries/csv-headers";
import {
  getCustomerDeliveryStatusLabel,
  getCustomerSmsProviderLabel,
  getCustomerWhatsAppProviderLabel,
} from "@/lib/ui/customer-labels";

import type { serializeDeliveryLog } from "./list";

export const MAX_DELIVERY_EXPORT_ROWS = 5000;

export const DELIVERY_CSV_HEADERS = [
  "contactName",
  "contactMobile",
  "templateName",
  "channel",
  "provider",
  "status",
  "attemptNumber",
  "providerMessageId",
  "errorMessage",
  "createdAt",
  "preview",
] as const;

type SerializedDelivery = ReturnType<typeof serializeDeliveryLog>;

function providerLabel(channel: string, provider: string | null): string {
  if (channel === "WHATSAPP") {
    return getCustomerWhatsAppProviderLabel(provider);
  }
  return getCustomerSmsProviderLabel(provider);
}

export function serializeDeliveriesToCsv(
  deliveries: SerializedDelivery[],
  locale: Locale = "en",
): string {
  const labels = getCsvHeaders(locale).deliveries;
  const lines = [
    DELIVERY_CSV_HEADERS.map((header) => escapeCsvField(labels[header])).join(","),
  ];

  for (const delivery of deliveries) {
    lines.push(
      [
        escapeCsvField(delivery.contactName),
        escapeCsvField(delivery.contactMobile),
        escapeCsvField(delivery.templateName),
        escapeCsvField(delivery.channel),
        escapeCsvField(providerLabel(delivery.channel, delivery.provider)),
        escapeCsvField(getCustomerDeliveryStatusLabel(delivery.status)),
        escapeCsvField(String(delivery.attemptNumber)),
        escapeCsvField(delivery.providerMessageId ?? ""),
        escapeCsvField(delivery.errorMessage ?? ""),
        escapeCsvField(delivery.createdAt),
        escapeCsvField(delivery.renderedPreview),
      ].join(","),
    );
  }

  return `${lines.join("\n")}\n`;
}
