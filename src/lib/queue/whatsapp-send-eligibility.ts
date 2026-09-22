import {
  Channel,
  ChannelProvider,
  type ChannelConfig,
  type MessageTemplate,
} from "@prisma/client";

import { QueueTemplateRejectedError } from "./errors";

export function assertWhatsAppTemplateEligibleForManualSend(
  template: Pick<
    MessageTemplate,
    | "isActive"
    | "channel"
    | "whatsappTemplateName"
    | "whatsappLanguage"
    | "whatsappParameterOrder"
  >,
  channelConfig: ChannelConfig | null,
) {
  if (!template.isActive) {
    throw new QueueTemplateRejectedError("Template is inactive");
  }

  if (template.channel !== Channel.WHATSAPP) {
    throw new QueueTemplateRejectedError(
      "Only active WhatsApp templates can be used for WhatsApp sending",
    );
  }

  if (!channelConfig || !channelConfig.isActive) {
    throw new QueueTemplateRejectedError(
      "WhatsApp channel must be configured before sending",
    );
  }

  if (channelConfig.channel !== Channel.WHATSAPP) {
    throw new QueueTemplateRejectedError(
      "WhatsApp channel configuration is invalid",
    );
  }

  if (
    channelConfig.provider !== ChannelProvider.TEST &&
    channelConfig.provider !== ChannelProvider.CUSTOM_HTTP &&
    channelConfig.provider !== ChannelProvider.META
  ) {
    throw new QueueTemplateRejectedError(
      "Configured WhatsApp provider is not supported",
    );
  }

  if (!template.whatsappTemplateName?.trim()) {
    throw new QueueTemplateRejectedError(
      "WhatsApp provider template name is required",
    );
  }

  if (!template.whatsappLanguage?.trim()) {
    throw new QueueTemplateRejectedError("WhatsApp language is required");
  }
}
