import {
  Channel,
  ChannelProvider,
  type ChannelConfig,
  type MessageTemplate,
} from "@prisma/client";

import { deriveRealSmsReadiness } from "@/lib/templates/readiness";

import { QueueTemplateRejectedError } from "./errors";

export type SmsProviderMode = "TEST" | "CUSTOM_HTTP";

/**
 * ChannelProvider.TEST can no longer be selected through the production SMS
 * channel-config UI/API - "TEST" here only ever occurs for a ChannelConfig
 * row created directly by test fixtures (bypassing the write-schema), so
 * real, unconfigured production sends fail closed instead of silently
 * succeeding as a simulated send.
 */
export function resolveSmsProviderMode(
  channelConfig: ChannelConfig | null,
): SmsProviderMode {
  if (!channelConfig || !channelConfig.isActive) {
    throw new QueueTemplateRejectedError(
      "SMS channel must be configured before sending",
    );
  }

  if (channelConfig.provider === ChannelProvider.TEST) {
    return "TEST";
  }

  if (channelConfig.provider === ChannelProvider.CUSTOM_HTTP) {
    return "CUSTOM_HTTP";
  }

  throw new QueueTemplateRejectedError(
    "Configured SMS provider is not supported for SMS sending",
  );
}

export function getSmsProviderModeLabel(
  providerMode: SmsProviderMode,
): "Test mode" | "Custom HTTP" {
  return providerMode === "TEST" ? "Test mode" : "Custom HTTP";
}

export function assertTemplateEligibleForProviderSend(
  template: Pick<
    MessageTemplate,
    "isActive" | "channel" | "body" | "dltTemplateId" | "dltApprovedContent"
  >,
  providerMode: SmsProviderMode,
) {
  if (!template.isActive) {
    throw new QueueTemplateRejectedError("Template is inactive");
  }

  if (template.channel !== Channel.SMS) {
    throw new QueueTemplateRejectedError(
      "Only active SMS templates can be used for SMS sending",
    );
  }

  if (providerMode === "TEST") {
    return;
  }

  const readiness = deriveRealSmsReadiness(template);

  if (!readiness.realSmsReady) {
    throw new QueueTemplateRejectedError(
      readiness.realSmsReadinessIssues[0] ??
        "SMS template is not ready for live SMS sending",
    );
  }
}
