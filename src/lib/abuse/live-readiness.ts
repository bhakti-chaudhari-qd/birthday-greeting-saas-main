import { Channel, ChannelProvider } from "@prisma/client";

import {
  readPlatformDefaultSms,
  readPlatformDefaultWhatsApp,
} from "@/lib/channel-config/platform-defaults";
import { prisma } from "@/lib/db";
import { deriveRealSmsReadiness } from "@/lib/templates/readiness";

export type LiveReadinessChecklistItem = {
  id: "dlt_templates" | "live_provider";
  label: string;
  done: boolean;
  href: string;
};

export type LiveChannelReadiness = {
  smsProvider: "TEST" | "CUSTOM_HTTP" | null;
  whatsappProvider: "TEST" | "CUSTOM_HTTP" | "META" | null;
  smsTemplatesReadyForLive: number;
  smsTemplatesNeedingSetup: number;
  checklist: LiveReadinessChecklistItem[];
  /** True when at least one checklist item is still incomplete. */
  showBanner: boolean;
};

function asProviderMode(
  provider: ChannelProvider | null | undefined,
): "TEST" | "CUSTOM_HTTP" | null {
  if (provider === ChannelProvider.CUSTOM_HTTP) {
    return "CUSTOM_HTTP";
  }
  if (provider === ChannelProvider.TEST) {
    return "TEST";
  }
  return null;
}

function asWhatsAppProviderMode(
  provider: ChannelProvider | null | undefined,
): "TEST" | "CUSTOM_HTTP" | "META" | null {
  if (provider === ChannelProvider.META) {
    return "META";
  }
  return asProviderMode(provider);
}

/**
 * Live gateways (Custom HTTP / Meta) are open on every plan, FREE included.
 * A client that can already send through a platform default route does not
 * need a gateway of its own, so that step is only listed when no platform
 * route exists. DLT setup is listed whenever the client has
 * SMS templates that still need it.
 */
export function buildLiveReadinessChecklist(input: {
  liveProviderDone: boolean;
  smsTemplateCount: number;
  smsTemplatesNeedingSetup: number;
  hasPlatformRoute: boolean;
}): LiveReadinessChecklistItem[] {
  const checklist: LiveReadinessChecklistItem[] = [];

  if (!input.hasPlatformRoute || input.smsTemplatesNeedingSetup > 0) {
    checklist.push({
      id: "dlt_templates",
      label:
        input.smsTemplateCount === 0
          ? "Create SMS templates and complete DLT setup for live SMS"
          : "Complete DLT setup for SMS templates",
      done: input.smsTemplateCount > 0 && input.smsTemplatesNeedingSetup === 0,
      href: "/dashboard/settings/sms/templates",
    });
  }

  if (!input.hasPlatformRoute) {
    checklist.push({
      id: "live_provider",
      label: "Switch SMS or WhatsApp to a live provider (Custom HTTP or Meta)",
      done: input.liveProviderDone,
      href: "/dashboard/settings/channels",
    });
  }

  return checklist;
}

/** Checklist for going live: DLT readiness and current provider mode. */
export async function getLiveChannelReadiness(
  organizationId: string,
  _userId: string,
): Promise<LiveChannelReadiness> {
  const [channelConfigs, smsTemplates] = await Promise.all([
    prisma.channelConfig.findMany({
      where: {
        organizationId,
        isActive: true,
        channel: { in: [Channel.SMS, Channel.WHATSAPP] },
      },
      select: { channel: true, provider: true },
    }),
    prisma.messageTemplate.findMany({
      where: {
        organizationId,
        channel: Channel.SMS,
        isActive: true,
      },
      select: {
        channel: true,
        dltTemplateId: true,
        dltApprovedContent: true,
        body: true,
        variables: true,
      },
    }),
  ]);

  const smsConfig = channelConfigs.find((row) => row.channel === Channel.SMS);
  const whatsappConfig = channelConfigs.find(
    (row) => row.channel === Channel.WHATSAPP,
  );
  const smsProvider = asProviderMode(smsConfig?.provider);
  const whatsappProvider = asWhatsAppProviderMode(whatsappConfig?.provider);

  let smsTemplatesReadyForLive = 0;
  let smsTemplatesNeedingSetup = 0;
  for (const template of smsTemplates) {
    const readiness = deriveRealSmsReadiness(template);
    if (readiness.realSmsReady) {
      smsTemplatesReadyForLive += 1;
    } else {
      smsTemplatesNeedingSetup += 1;
    }
  }

  const liveProviderDone =
    smsProvider === "CUSTOM_HTTP" ||
    whatsappProvider === "CUSTOM_HTTP" ||
    whatsappProvider === "META";

  const checklist = buildLiveReadinessChecklist({
    liveProviderDone,
    smsTemplateCount: smsTemplates.length,
    smsTemplatesNeedingSetup,
    hasPlatformRoute: Boolean(
      readPlatformDefaultSms() ||
        readPlatformDefaultWhatsApp() ||
        process.env.RESEND_API_KEY?.trim(),
    ),
  });

  const showBanner = checklist.some((item) => !item.done);

  return {
    smsProvider,
    whatsappProvider,
    smsTemplatesReadyForLive,
    smsTemplatesNeedingSetup,
    checklist,
    showBanner,
  };
}
