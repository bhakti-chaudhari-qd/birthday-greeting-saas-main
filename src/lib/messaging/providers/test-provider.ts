import { Channel, ChannelProvider } from "@prisma/client";

import { TEST_PROVIDER_FAIL_MOBILE_SUFFIX } from "@/lib/queue/constants";

import {
  ProviderSendError,
  isEmailSendRequest,
  isWhatsAppSendRequest,
  type DeliveryStatusCapableProvider,
  type DeliveryStatusLookupRequest,
  type MessageSendRequest,
  type MessageSendResult,
  type ProviderDeliveryStatusResult,
} from "./types";

function buildProviderMessageId(request: MessageSendRequest): string {
  const prefix = isWhatsAppSendRequest(request)
    ? "test-wa"
    : isEmailSendRequest(request)
      ? "test-email"
      : "test";
  return `${prefix}-${request.idempotencyKey}-${request.attemptNumber}`;
}

function shouldFailDeterministically(request: MessageSendRequest): boolean {
  return (
    request.recipient.endsWith(TEST_PROVIDER_FAIL_MOBILE_SUFFIX) &&
    request.attemptNumber === 1
  );
}

function resolveTestDeliveryStatus(
  providerMessageId: string,
): ProviderDeliveryStatusResult {
  if (providerMessageId.endsWith("-ds-delivered")) {
    return { outcome: "delivered", rawProviderStatus: "DELIVRD" };
  }

  if (providerMessageId.endsWith("-ds-undelivered")) {
    return {
      outcome: "undelivered",
      rawProviderStatus: "FULLY BLOCKED or PROMO BLOCKED",
    };
  }

  if (providerMessageId.endsWith("-ds-pending")) {
    return { outcome: "pending", rawProviderStatus: "SUBMITTED" };
  }

  if (providerMessageId.endsWith("-ds-unknown")) {
    return { outcome: "unknown", rawProviderStatus: "CUSTOM_STATUS" };
  }

  return { outcome: "unknown", rawProviderStatus: "UNMAPPED_TEST_STATUS" };
}

export const testProvider: DeliveryStatusCapableProvider = {
  name: ChannelProvider.TEST,

  async send(request: MessageSendRequest): Promise<MessageSendResult> {
    if (!request.recipient.trim()) {
      throw new ProviderSendError("Recipient is required", "INVALID_RECIPIENT");
    }

    if (isWhatsAppSendRequest(request)) {
      if (request.channel !== Channel.WHATSAPP) {
        throw new ProviderSendError(
          "Invalid WhatsApp send request",
          "INVALID_BODY",
        );
      }

      if (!request.templateName.trim()) {
        throw new ProviderSendError(
          "WhatsApp template name is required",
          "MISSING_TEMPLATE_ID",
        );
      }

      if (!request.language.trim()) {
        throw new ProviderSendError(
          "WhatsApp language is required",
          "INVALID_BODY",
        );
      }

      if (!Array.isArray(request.parameterValues)) {
        throw new ProviderSendError(
          "WhatsApp parameter values are required",
          "INVALID_BODY",
        );
      }

      if (
        request.parameterValues.some(
          (value) => typeof value !== "string" || value.trim() === "",
        )
      ) {
        throw new ProviderSendError(
          "WhatsApp parameter values must be non-empty strings",
          "INVALID_BODY",
        );
      }

      if (shouldFailDeterministically(request)) {
        throw new ProviderSendError(
          "Deterministic test provider failure",
          "TEST_PROVIDER_FAIL",
        );
      }

      return {
        providerMessageId: buildProviderMessageId(request),
        status: "SENT",
      };
    }

    if (isEmailSendRequest(request)) {
      if (!request.subject.trim()) {
        throw new ProviderSendError(
          "Email subject is required",
          "INVALID_BODY",
        );
      }

      if (!request.body.trim()) {
        throw new ProviderSendError("Email body is required", "INVALID_BODY");
      }

      if (shouldFailDeterministically(request)) {
        throw new ProviderSendError(
          "Deterministic test provider failure",
          "TEST_PROVIDER_FAIL",
        );
      }

      return {
        providerMessageId: buildProviderMessageId(request),
        status: "SENT",
      };
    }

    if (!request.body.trim()) {
      throw new ProviderSendError("Message body is required", "INVALID_BODY");
    }

    if (shouldFailDeterministically(request)) {
      throw new ProviderSendError(
        "Deterministic test provider failure",
        "TEST_PROVIDER_FAIL",
      );
    }

    return {
      providerMessageId: buildProviderMessageId(request),
      status: "SENT",
    };
  },

  async getDeliveryStatus(
    request: DeliveryStatusLookupRequest,
  ): Promise<ProviderDeliveryStatusResult> {
    const providerMessageId = request.providerMessageId.trim();

    if (!providerMessageId) {
      throw new ProviderSendError(
        "Provider message ID is required",
        "MISSING_PROVIDER_MESSAGE_ID",
      );
    }

    return resolveTestDeliveryStatus(providerMessageId);
  },
};
