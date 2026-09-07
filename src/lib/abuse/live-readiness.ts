import {
  Channel,
  ChannelProvider,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import { deriveRealSmsReadiness } from "@/lib/templates/readiness";

const PAID_PLANS: ReadonlySet<SubscriptionPlan> = new Set([
  SubscriptionPlan.STARTER,
  SubscriptionPlan.PRO,
  SubscriptionPlan.CUSTOM,
]);

export type LiveReadinessChecklistItem = {
  id: "paid_plan" | "dlt_templates" | "live_provider";
  label: string;
  done: boolean;
  href: string;
};

export type LiveChannelReadiness = {
  paidPlanActive: boolean;
  liveChannelsApproved: boolean;
  canEnableLiveCustomHttp: boolean;
  smsProvider: "TEST" | "CUSTOM_HTTP" | null;
  whatsappProvider: "TEST" | "CUSTOM_HTTP" | null;
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

/**
 * Checklist for going live with Custom HTTP (mirrors assertLiveCustomHttpAllowed
 * plus DLT readiness and current provider mode).
 */
export async function getLiveChannelReadiness(
  organizationId: string,
  _userId: string,
): Promise<LiveChannelReadiness> {
  const [organization, channelConfigs, smsTemplates] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: { subscription: true },
    }),
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

  const liveChannelsApproved = organization.liveChannelsApproved;
  const subscription = organization.subscription;
  const paidPlanActive = Boolean(
    subscription &&
      subscription.status === SubscriptionStatus.ACTIVE &&
      PAID_PLANS.has(subscription.plan),
  );
  const canEnableLiveCustomHttp = paidPlanActive || liveChannelsApproved;

  const smsConfig = channelConfigs.find((row) => row.channel === Channel.SMS);
  const whatsappConfig = channelConfigs.find(
    (row) => row.channel === Channel.WHATSAPP,
  );
  const smsProvider = asProviderMode(smsConfig?.provider);
  const whatsappProvider = asProviderMode(whatsappConfig?.provider);

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
    smsProvider === "CUSTOM_HTTP" || whatsappProvider === "CUSTOM_HTTP";
  const dltDone = smsTemplates.length > 0 && smsTemplatesNeedingSetup === 0;

  const checklist: LiveReadinessChecklistItem[] = [
    {
      id: "paid_plan",
      label: liveChannelsApproved
        ? "Live messaging approved by platform"
        : "Activate a paid plan (Starter or Pro)",
      done: paidPlanActive || liveChannelsApproved,
      href: "/dashboard/settings/billing",
    },
    {
      id: "dlt_templates",
      label:
        smsTemplates.length === 0
          ? "Create SMS templates and complete DLT setup for live SMS"
          : "Complete DLT setup for SMS templates",
      done: dltDone,
      href: "/dashboard/settings/sms/templates",
    },
    {
      id: "live_provider",
      label: "Switch SMS or WhatsApp to Custom HTTP (live)",
      done: liveProviderDone,
      href: "/dashboard/settings/channels",
    },
  ];

  const showBanner = checklist.some((item) => !item.done);

  return {
    paidPlanActive,
    liveChannelsApproved,
    canEnableLiveCustomHttp,
    smsProvider,
    whatsappProvider,
    smsTemplatesReadyForLive,
    smsTemplatesNeedingSetup,
    checklist,
    showBanner,
  };
}
