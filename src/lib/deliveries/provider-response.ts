import type { Prisma } from "@prisma/client";

import type { ProviderDeliveryOutcome } from "@/lib/messaging/providers/types";

export type DeliveryStatusMetadata = {
  rawProviderStatus: string;
  outcome: ProviderDeliveryOutcome;
  refreshedAt: string;
  providerMessage?: string;
};

export function mergeDeliveryStatusMetadata(
  existing: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
  metadata: DeliveryStatusMetadata,
): Prisma.InputJsonValue {
  const base =
    existing &&
    typeof existing === "object" &&
    !Array.isArray(existing)
      ? { ...existing }
      : {};

  return {
    ...base,
    deliveryStatus: metadata,
  };
}
