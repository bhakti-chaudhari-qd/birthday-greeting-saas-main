import type { ChannelConfig } from "@prisma/client";
import { Channel, ChannelProvider } from "@prisma/client";

import { resolveEmailProviderConfig } from "@/lib/channel-config/email-resolve";
import { resolveSmsProviderConfig } from "@/lib/channel-config/resolve";
import { resolveWhatsAppHttpProviderConfig } from "@/lib/channel-config/whatsapp-resolve";

import { createResendEmailProvider } from "./email/resend-email-provider";
import { createLegacyHttpSmsProvider } from "./sms/legacy-http-sms-provider";
import { testProvider } from "./test-provider";
import { ProviderSendError, type MessageProvider } from "./types";
import { createCustomHttpWhatsAppProvider } from "./whatsapp/custom-http-whatsapp-provider";

/**
 * ChannelProvider.TEST is deliberately still handled below - it can no
 * longer be selected through the production channel-config UI/API (removed
 * from every write-schema's provider enum), but automated tests still
 * create ChannelConfig rows with provider: TEST directly to exercise the
 * real SendQueue/worker/send.ts pipeline without hitting a live provider.
 * That is the "automated testing mocks" case, not a production option.
 */
export function resolveMessageProvider(
  channelConfig: ChannelConfig | null,
  channel: Channel,
): MessageProvider {
  if (channel === Channel.EMAIL) {
    // A configured, active RESEND ChannelConfig sends with the
    // organization's own API key and from address; otherwise falls back to
    // the platform-wide RESEND_API_KEY/EMAIL_FROM env vars (organizations
    // that haven't configured their own Email channel yet keep working
    // unchanged).
    if (channelConfig?.provider === ChannelProvider.TEST) {
      return testProvider;
    }
    if (channelConfig?.provider === ChannelProvider.RESEND) {
      return createResendEmailProvider(resolveEmailProviderConfig(channelConfig));
    }
    return createResendEmailProvider();
  }

  if (channel === Channel.WHATSAPP) {
    if (!channelConfig || !channelConfig.isActive) {
      throw new ProviderSendError(
        "WhatsApp channel is not configured",
        "INVALID_PROVIDER_CONFIG",
      );
    }

    if (channelConfig.channel !== Channel.WHATSAPP) {
      throw new ProviderSendError(
        "WhatsApp channel configuration is invalid",
        "INVALID_PROVIDER_CONFIG",
      );
    }

    if (channelConfig.provider === ChannelProvider.TEST) {
      return testProvider;
    }

    if (channelConfig.provider === ChannelProvider.CUSTOM_HTTP) {
      return createCustomHttpWhatsAppProvider(
        resolveWhatsAppHttpProviderConfig(channelConfig),
      );
    }

    throw new ProviderSendError(
      "Configured WhatsApp provider is not supported",
      "UNKNOWN_PROVIDER",
    );
  }

  if (channel !== Channel.SMS) {
    throw new ProviderSendError(
      "Messaging channel is not supported",
      "UNKNOWN_PROVIDER",
    );
  }

  if (!channelConfig || !channelConfig.isActive) {
    throw new ProviderSendError(
      "SMS channel is not configured",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  if (channelConfig.channel !== Channel.SMS) {
    throw new ProviderSendError(
      "SMS channel configuration is invalid",
      "INVALID_PROVIDER_CONFIG",
    );
  }

  switch (channelConfig.provider) {
    case ChannelProvider.TEST:
      return testProvider;
    case ChannelProvider.CUSTOM_HTTP:
      return createLegacyHttpSmsProvider(
        resolveSmsProviderConfig(channelConfig),
      );
    default:
      throw new ProviderSendError(
        "Configured messaging provider is not supported",
        "UNKNOWN_PROVIDER",
      );
  }
}

export function getMessageProvider(
  channelConfig: ChannelConfig | null | undefined,
  channel: Channel,
): MessageProvider {
  return resolveMessageProvider(channelConfig ?? null, channel);
}
