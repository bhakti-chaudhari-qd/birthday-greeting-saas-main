import { describe, expect, it } from "vitest";

import { mergeDeliveryStatusMetadata } from "@/lib/deliveries/provider-response";

describe("mergeDeliveryStatusMetadata", () => {
  it("preserves existing send metadata and nests delivery status", () => {
    const merged = mergeDeliveryStatusMetadata(
      {
        provider: "CUSTOM_HTTP",
        units: 1,
      },
      {
        rawProviderStatus: "DELIVRD",
        outcome: "delivered",
        refreshedAt: "2026-07-11T12:00:00.000Z",
      },
    );

    expect(merged).toEqual({
      provider: "CUSTOM_HTTP",
      units: 1,
      deliveryStatus: {
        rawProviderStatus: "DELIVRD",
        outcome: "delivered",
        refreshedAt: "2026-07-11T12:00:00.000Z",
      },
    });
  });

  it("replaces only the deliveryStatus portion on repeated refresh", () => {
    const first = mergeDeliveryStatusMetadata(
      { provider: "TEST" },
      {
        rawProviderStatus: "SUBMITTED",
        outcome: "pending",
        refreshedAt: "2026-07-11T12:00:00.000Z",
      },
    );

    const second = mergeDeliveryStatusMetadata(first, {
      rawProviderStatus: "DELIVRD",
      outcome: "delivered",
      refreshedAt: "2026-07-11T13:00:00.000Z",
      providerMessage: "Success",
    });

    expect(second).toEqual({
      provider: "TEST",
      deliveryStatus: {
        rawProviderStatus: "DELIVRD",
        outcome: "delivered",
        refreshedAt: "2026-07-11T13:00:00.000Z",
        providerMessage: "Success",
      },
    });
  });

  it("handles malformed legacy providerResponse values safely", () => {
    const merged = mergeDeliveryStatusMetadata("legacy-string", {
      rawProviderStatus: "UNDELIV",
      outcome: "undelivered",
      refreshedAt: "2026-07-11T12:00:00.000Z",
    });

    expect(merged).toEqual({
      deliveryStatus: {
        rawProviderStatus: "UNDELIV",
        outcome: "undelivered",
        refreshedAt: "2026-07-11T12:00:00.000Z",
      },
    });
  });
});
