import type { ProviderDeliveryOutcome } from "@/lib/messaging/providers/types";

import { DeliveryStatusLookupError } from "@/lib/messaging/providers/types";

export type LegacySmsStatusRecord = {
  Mobile?: unknown;
  DeliveryStatus?: unknown;
};

export type ParsedLegacySmsStatusResponse = {
  providerMessage: string;
  records: LegacySmsStatusRecord[];
};

const DELIVERED_STATUSES = new Set(["delivrd"]);

const UNDELIVERED_STATUSES = new Set([
  "undeliv",
  "unknown subscriber",
  "abort",
  "facility not supported",
  "fully blocked or promo blocked",
]);

const PENDING_STATUSES = new Set([
  "submitted",
  "sent",
  "pending",
  "enroute",
  "buffered",
  "accepted",
]);

export function normalizeProviderStatusString(value: string): string {
  return value.trim().toLowerCase();
}

export function mapProviderStatusToOutcome(
  rawStatus: string,
): ProviderDeliveryOutcome {
  const normalized = normalizeProviderStatusString(rawStatus);

  if (DELIVERED_STATUSES.has(normalized)) {
    return "delivered";
  }

  if (UNDELIVERED_STATUSES.has(normalized)) {
    return "undelivered";
  }

  if (PENDING_STATUSES.has(normalized)) {
    return "pending";
  }

  return "unknown";
}

export function parseLegacySmsStatusResponse(
  raw: string,
): ParsedLegacySmsStatusResponse {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DeliveryStatusLookupError(
      "SMS provider returned invalid status response",
      "INVALID_STATUS_RESPONSE",
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new DeliveryStatusLookupError(
      "SMS provider returned invalid status response",
      "INVALID_STATUS_RESPONSE",
    );
  }

  const envelope = parsed as Record<string, unknown>;

  if (envelope.Status === false) {
    const message =
      typeof envelope.Message === "string" && envelope.Message.trim()
        ? envelope.Message.trim()
        : "SMS provider rejected the status query";

    throw new DeliveryStatusLookupError(message, "STATUS_QUERY_REJECTED");
  }

  if (envelope.Status !== true) {
    throw new DeliveryStatusLookupError(
      "SMS provider returned invalid status response",
      "INVALID_STATUS_RESPONSE",
    );
  }

  const providerMessage =
    typeof envelope.Message === "string" ? envelope.Message : "";

  if (!Array.isArray(envelope.Response)) {
    throw new DeliveryStatusLookupError(
      "SMS provider returned no delivery status records",
      "MISSING_STATUS_RECORDS",
    );
  }

  if (envelope.Response.length === 0) {
    throw new DeliveryStatusLookupError(
      "SMS provider returned no delivery status records",
      "EMPTY_STATUS_RECORDS",
    );
  }

  const records = envelope.Response.filter(
    (record): record is LegacySmsStatusRecord =>
      Boolean(record) && typeof record === "object" && !Array.isArray(record),
  );

  if (records.length === 0) {
    throw new DeliveryStatusLookupError(
      "SMS provider returned invalid status records",
      "INVALID_STATUS_RECORDS",
    );
  }

  return {
    providerMessage,
    records,
  };
}

export function normalizeMobileDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export type RecipientMatchResult =
  | {
      matched: true;
      record: LegacySmsStatusRecord;
      rawProviderStatus: string;
    }
  | {
      matched: false;
      reason: "missing_delivery_status" | "no_match" | "ambiguous";
    };

export function selectRecipientStatusRecord(
  records: LegacySmsStatusRecord[],
  expectedRecipientDigits: string,
): RecipientMatchResult {
  const candidates: Array<{
    record: LegacySmsStatusRecord;
    rawProviderStatus: string;
  }> = [];

  for (const record of records) {
    if (typeof record.Mobile !== "string" || !record.Mobile.trim()) {
      continue;
    }

    if (normalizeMobileDigits(record.Mobile) !== expectedRecipientDigits) {
      continue;
    }

    if (
      typeof record.DeliveryStatus !== "string" ||
      !record.DeliveryStatus.trim()
    ) {
      return { matched: false, reason: "missing_delivery_status" };
    }

    candidates.push({
      record,
      rawProviderStatus: record.DeliveryStatus.trim(),
    });
  }

  if (candidates.length === 0) {
    return { matched: false, reason: "no_match" };
  }

  if (candidates.length > 1) {
    const uniqueStatuses = new Set(
      candidates.map((candidate) =>
        normalizeProviderStatusString(candidate.rawProviderStatus),
      ),
    );

    if (uniqueStatuses.size > 1) {
      return { matched: false, reason: "ambiguous" };
    }
  }

  return {
    matched: true,
    record: candidates[0]!.record,
    rawProviderStatus: candidates[0]!.rawProviderStatus,
  };
}
