import { describe, expect, it } from "vitest";

import {
  mapProviderStatusToOutcome,
  normalizeProviderStatusString,
  parseLegacySmsStatusResponse,
  selectRecipientStatusRecord,
} from "@/lib/messaging/providers/sms/parse-status-response";
import { DeliveryStatusLookupError } from "@/lib/messaging/providers/types";

describe("parseLegacySmsStatusResponse", () => {
  it("parses a successful provider response", () => {
    const parsed = parseLegacySmsStatusResponse(
      JSON.stringify({
        Status: true,
        Message: "Success",
        Response: [{ Mobile: "919876543210", DeliveryStatus: "DELIVRD" }],
      }),
    );

    expect(parsed.providerMessage).toBe("Success");
    expect(parsed.records).toHaveLength(1);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseLegacySmsStatusResponse("{not-json")).toThrow(
      DeliveryStatusLookupError,
    );
  });

  it("rejects invalid response shape", () => {
    expect(() =>
      parseLegacySmsStatusResponse(JSON.stringify({ Status: true })),
    ).toThrow(DeliveryStatusLookupError);
  });

  it("rejects Status:false responses", () => {
    expect(() =>
      parseLegacySmsStatusResponse(
        JSON.stringify({
          Status: false,
          Message: "Date format must be yyyy-MM-dd",
        }),
      ),
    ).toThrow(/Date format must be yyyy-MM-dd/);
  });

  it("rejects empty Response arrays", () => {
    expect(() =>
      parseLegacySmsStatusResponse(
        JSON.stringify({ Status: true, Message: "Success", Response: [] }),
      ),
    ).toThrow(DeliveryStatusLookupError);
  });
});

describe("mapProviderStatusToOutcome", () => {
  it.each([
    ["DELIVRD", "delivered"],
    ["delivrd", "delivered"],
    [" UNDELIV ", "undelivered"],
    ["Unknown subscriber", "undelivered"],
    ["Abort", "undelivered"],
    ["Facility not supported", "undelivered"],
    ["FULLY BLOCKED or PROMO BLOCKED", "undelivered"],
    ["SUBMITTED", "pending"],
    ["CUSTOM_STATUS", "unknown"],
  ])("maps %s to %s", (status, outcome) => {
    expect(mapProviderStatusToOutcome(status)).toBe(outcome);
  });
});

describe("normalizeProviderStatusString", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeProviderStatusString("  DELIVRD  ")).toBe("delivrd");
  });
});

describe("selectRecipientStatusRecord", () => {
  it("selects a unique matching recipient record", () => {
    const match = selectRecipientStatusRecord(
      [
        { Mobile: "918888888888", DeliveryStatus: "UNDELIV" },
        { Mobile: "919876543210", DeliveryStatus: "DELIVRD" },
      ],
      "919876543210",
    );

    expect(match).toEqual({
      matched: true,
      record: { Mobile: "919876543210", DeliveryStatus: "DELIVRD" },
      rawProviderStatus: "DELIVRD",
    });
  });

  it("returns no_match when no record matches", () => {
    expect(
      selectRecipientStatusRecord(
        [{ Mobile: "918888888888", DeliveryStatus: "DELIVRD" }],
        "919876543210",
      ),
    ).toEqual({ matched: false, reason: "no_match" });
  });

  it("returns ambiguous when duplicate matches disagree", () => {
    expect(
      selectRecipientStatusRecord(
        [
          { Mobile: "919876543210", DeliveryStatus: "DELIVRD" },
          { Mobile: "+919876543210", DeliveryStatus: "UNDELIV" },
        ],
        "919876543210",
      ),
    ).toEqual({ matched: false, reason: "ambiguous" });
  });

  it("returns missing_delivery_status when the matched record has no status", () => {
    expect(
      selectRecipientStatusRecord(
        [{ Mobile: "919876543210", DeliveryStatus: "" }],
        "919876543210",
      ),
    ).toEqual({ matched: false, reason: "missing_delivery_status" });
  });

  it("ignores invalid Mobile values instead of matching blindly", () => {
    expect(
      selectRecipientStatusRecord(
        [{ Mobile: 919876543210, DeliveryStatus: "DELIVRD" }],
        "919876543210",
      ),
    ).toEqual({ matched: false, reason: "no_match" });
  });
});
