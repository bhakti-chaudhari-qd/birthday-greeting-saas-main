import { ChannelProvider } from "@prisma/client";

import type { ResolvedSmsProviderConfig } from "@/lib/channel-config/types";
import {
  LEGACY_SMS_BALANCE_PATH,
  LEGACY_SMS_STATUS_PATH,
} from "@/lib/channel-config/resolve";

import {
  formatIndianSmsRecipient,
  formatIndianSmsRecipientDigits,
} from "./format-recipient";
import {
  mapLegacySmsStatusToError,
  parseLegacySmsBalanceResponse,
  parseLegacySmsResponse,
} from "./parse-response";
import {
  mapProviderStatusToOutcome,
  parseLegacySmsStatusResponse,
  selectRecipientStatusRecord,
} from "./parse-status-response";
import {
  DeliveryStatusLookupError,
  ProviderSendError,
  isSmsSendRequest,
  type DeliveryStatusCapableProvider,
  type DeliveryStatusLookupRequest,
  type MessageSendRequest,
  type MessageSendResult,
} from "../types";
import { assertPublicHttpTarget } from "../ssrf-guard";

export type LegacyHttpSmsProviderConfig = ResolvedSmsProviderConfig & {
  fetchFn?: typeof fetch;
};

export function buildLegacySmsSendUrl(
  config: ResolvedSmsProviderConfig,
  params: {
    numbers: string;
    message: string;
    templateId: string;
  },
): string {
  const url = new URL(config.sendPath, config.baseUrl);
  const search = new URLSearchParams({
    username: config.username,
    pass: config.password,
    route: config.route,
    senderid: config.senderId,
    numbers: params.numbers,
    message: params.message,
    templateid: params.templateId,
  });

  url.search = search.toString();
  return url.toString();
}

export function buildLegacySmsStatusUrl(
  config: ResolvedSmsProviderConfig,
  params: {
    msgid: string;
    date: string;
  },
): string {
  const url = new URL(LEGACY_SMS_STATUS_PATH, config.baseUrl);
  const search = new URLSearchParams({
    username: config.username,
    pass: config.password,
    msgid: params.msgid,
    date: params.date,
  });

  url.search = search.toString();
  return url.toString();
}

export function buildLegacySmsBalanceUrl(
  config: ResolvedSmsProviderConfig,
): string {
  const url = new URL(LEGACY_SMS_BALANCE_PATH, config.baseUrl);
  const search = new URLSearchParams({
    username: config.username,
    pass: config.password,
  });

  url.search = search.toString();
  return url.toString();
}

async function fetchProviderResponse(
  fetchFn: typeof fetch,
  requestUrl: string,
  timeoutMs: number,
): Promise<string> {
  await assertPublicHttpTarget(requestUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(requestUrl, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new DeliveryStatusLookupError(
        "SMS provider status request failed",
        "PROVIDER_ERROR",
      );
    }

    return response.text();
  } catch (error) {
    if (
      error instanceof DeliveryStatusLookupError ||
      error instanceof ProviderSendError
    ) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new DeliveryStatusLookupError(
        "SMS provider status request timed out",
        "PROVIDER_TIMEOUT",
      );
    }

    throw new DeliveryStatusLookupError(
      "SMS provider status request failed",
      "PROVIDER_ERROR",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function createLegacyHttpSmsProvider(
  config: LegacyHttpSmsProviderConfig,
): DeliveryStatusCapableProvider {
  const fetchFn = config.fetchFn ?? fetch;

  return {
    name: ChannelProvider.CUSTOM_HTTP,

    async send(request: MessageSendRequest): Promise<MessageSendResult> {
      if (!isSmsSendRequest(request)) {
        throw new ProviderSendError(
          "Legacy HTTP SMS provider only supports SMS send requests",
          "INVALID_BODY",
        );
      }

      if (!request.recipient.trim()) {
        throw new ProviderSendError("Recipient is required", "INVALID_RECIPIENT");
      }

      if (!request.body.trim()) {
        throw new ProviderSendError("Message body is required", "INVALID_BODY");
      }

      const dltTemplateId = request.dltTemplateId?.trim();

      if (!dltTemplateId) {
        throw new ProviderSendError(
          "SMS DLT template ID is missing",
          "MISSING_TEMPLATE_ID",
        );
      }

      const numbers = formatIndianSmsRecipient(request.recipient);

      // The upstream provider requires HTTP GET with credentials in query parameters.
      // Never log the generated request URL or raw query string.
      const requestUrl = buildLegacySmsSendUrl(config, {
        numbers,
        message: request.body,
        templateId: dltTemplateId,
      });

      await assertPublicHttpTarget(requestUrl);

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        config.requestTimeoutMs,
      );

      let responseText: string;

      try {
        const response = await fetchFn(requestUrl, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 429) {
            // This gateway does not prove non-acceptance on 429.
            throw new ProviderSendError(
              "SMS provider rate limited the request",
              "PROVIDER_HTTP_429",
            );
          }

          if (response.status >= 500) {
            // Acceptance cannot be proven from HTTP 5xx alone for this gateway.
            throw new ProviderSendError(
              "SMS provider returned a server error",
              "PROVIDER_HTTP_5XX",
            );
          }

          throw new ProviderSendError(
            "SMS provider rejected the request",
            "PROVIDER_HTTP_4XX",
          );
        }

        responseText = await response.text();
      } catch (error) {
        if (error instanceof ProviderSendError) {
          throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
          throw new ProviderSendError(
            "SMS provider request timed out",
            "PROVIDER_TIMEOUT",
          );
        }

        throw new ProviderSendError(
          "SMS provider request failed",
          "PROVIDER_NETWORK_ERROR",
        );
      } finally {
        clearTimeout(timeout);
      }

      const parsed = parseLegacySmsResponse(responseText, {
        successStatusCode: config.successStatusCode,
      });

      if (!parsed.success) {
        const mapped = mapLegacySmsStatusToError(parsed.statusCode);
        throw new ProviderSendError(mapped.message, mapped.code);
      }

      return {
        providerMessageId: parsed.providerMessageId,
        status: "SENT",
        units: parsed.units,
      };
    },

    async getDeliveryStatus(request: DeliveryStatusLookupRequest) {
      const providerMessageId = request.providerMessageId.trim();
      const submissionDate = request.submissionDate.trim();

      if (!providerMessageId) {
        throw new DeliveryStatusLookupError(
          "Provider message ID is required",
          "MISSING_PROVIDER_MESSAGE_ID",
        );
      }

      if (!submissionDate) {
        throw new DeliveryStatusLookupError(
          "Submission date is required",
          "MISSING_SUBMISSION_DATE",
        );
      }

      if (!request.recipient.trim()) {
        throw new DeliveryStatusLookupError(
          "Recipient is required",
          "INVALID_RECIPIENT",
        );
      }

      const expectedRecipientDigits = formatIndianSmsRecipientDigits(
        request.recipient,
      );

      // Never log the generated request URL or raw query string.
      const requestUrl = buildLegacySmsStatusUrl(config, {
        msgid: providerMessageId,
        date: submissionDate,
      });

      const responseText = await fetchProviderResponse(
        fetchFn,
        requestUrl,
        config.requestTimeoutMs,
      );

      const parsed = parseLegacySmsStatusResponse(responseText);
      const match = selectRecipientStatusRecord(
        parsed.records,
        expectedRecipientDigits,
      );

      if (!match.matched) {
        switch (match.reason) {
          case "missing_delivery_status":
            throw new DeliveryStatusLookupError(
              "SMS provider returned a matching record without delivery status",
              "MISSING_DELIVERY_STATUS",
            );
          case "ambiguous":
            throw new DeliveryStatusLookupError(
              "SMS provider returned ambiguous delivery status records",
              "AMBIGUOUS_STATUS_RECORDS",
            );
          default:
            throw new DeliveryStatusLookupError(
              "SMS provider returned no matching delivery status record",
              "NO_MATCHING_STATUS_RECORD",
            );
        }
      }

      return {
        outcome: mapProviderStatusToOutcome(match.rawProviderStatus),
        rawProviderStatus: match.rawProviderStatus,
        providerMessage: parsed.providerMessage || undefined,
      };
    },
  };
}

export type LegacySmsBalanceLookupResult = {
  balanceCredits: number | null;
};

function mapLegacySmsBalanceLookupError(
  parsed: ReturnType<typeof parseLegacySmsBalanceResponse>,
): never {
  if (parsed.invalidCredentials) {
    throw new ProviderSendError(
      "Invalid SMS provider credentials",
      "INVALID_CREDENTIALS",
    );
  }

  const mapped = mapLegacySmsStatusToError(parsed.statusCode);
  throw new ProviderSendError(mapped.message, mapped.code);
}

export async function fetchLegacyHttpSmsBalance(
  config: LegacyHttpSmsProviderConfig,
): Promise<LegacySmsBalanceLookupResult> {
  const fetchFn = config.fetchFn ?? fetch;

  // Never log the generated request URL or raw query string.
  const requestUrl = buildLegacySmsBalanceUrl(config);

  const responseText = await fetchProviderResponse(
    fetchFn,
    requestUrl,
    config.requestTimeoutMs,
  );

  const parsed = parseLegacySmsBalanceResponse(responseText, {
    preferredRoute: config.route,
  });

  if (parsed.valid) {
    return {
      balanceCredits: parsed.balanceCredits ?? null,
    };
  }

  mapLegacySmsBalanceLookupError(parsed);
}

export async function verifyLegacyHttpSmsConfiguration(
  config: LegacyHttpSmsProviderConfig,
): Promise<LegacySmsBalanceLookupResult> {
  return fetchLegacyHttpSmsBalance(config);
}
