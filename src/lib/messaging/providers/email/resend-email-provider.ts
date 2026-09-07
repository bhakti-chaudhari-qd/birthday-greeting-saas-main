import { sendEmail } from "@/lib/email/send";
import type { ResolvedEmailProviderConfig } from "@/lib/channel-config/email-types";

import {
  ProviderSendError,
  type MessageProvider,
  type MessageSendRequest,
  type MessageSendResult,
} from "../types";

function isEmailSendRequest(
  request: MessageSendRequest,
): request is Extract<MessageSendRequest, { channel: "EMAIL" }> {
  return request.channel === "EMAIL";
}

function formatFromAddress(config: ResolvedEmailProviderConfig): string {
  return config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail;
}

/**
 * Email provider (Resend). Uses the organization's configured API key/from
 * address when provided; otherwise falls back to the platform-wide
 * RESEND_API_KEY / EMAIL_FROM env vars, preserving pre-per-org behavior for
 * organizations that haven't configured their own Email channel yet.
 */
export function createResendEmailProvider(
  organizationConfig?: ResolvedEmailProviderConfig,
): MessageProvider {
  return {
    name: "RESEND",

    async send(request: MessageSendRequest): Promise<MessageSendResult> {
      if (!isEmailSendRequest(request)) {
        throw new ProviderSendError(
          "Invalid email send request",
          "INVALID_BODY",
        );
      }

      if (!request.recipient.trim()) {
        throw new ProviderSendError(
          "Email recipient is required",
          "INVALID_RECIPIENT",
        );
      }

      if (!request.subject.trim()) {
        throw new ProviderSendError(
          "Email subject is required",
          "INVALID_BODY",
        );
      }

      if (!request.body.trim()) {
        throw new ProviderSendError("Email body is required", "INVALID_BODY");
      }

      if (!organizationConfig?.apiKey && !process.env.RESEND_API_KEY?.trim()) {
        throw new ProviderSendError(
          "Email channel is not configured",
          "INVALID_PROVIDER_CONFIG",
        );
      }

      try {
        await sendEmail({
          to: request.recipient.trim(),
          subject: request.subject.trim(),
          text: request.body.trim(),
          html: `<p>${request.body
            .trim()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br/>")}</p>`,
          // Generic MessageProvider attachment shape maps 1:1 onto the
          // Resend-facing SendEmailAttachment shape - this is the only
          // place that translation happens; nothing upstream of `request`
          // knows this ends up as a Resend API payload.
          attachments: request.attachments,
          ...(organizationConfig
            ? {
                apiKey: organizationConfig.apiKey,
                from: formatFromAddress(organizationConfig),
              }
            : {}),
        });
      } catch (error) {
        throw new ProviderSendError(
          error instanceof Error ? error.message : "Email send failed",
          "PROVIDER_SEND_FAILED",
        );
      }

      return {
        providerMessageId: `email-${request.idempotencyKey}-${request.attemptNumber}`,
        status: "SENT",
      };
    },
  };
}
