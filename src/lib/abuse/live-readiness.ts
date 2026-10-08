import {
  Channel,
  ChannelProvider,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";

import {
  readPlatformDefaultSms,
  readPlatformDefaultWhatsApp,
} from "@/lib/channel-config/platform-defaults";
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
 * A client that can already send through a platform default route does not
 * need a paid plan or a gateway of its own, so those steps are only listed
 * when no platform route exists. DLT setup is listed whenever the client has
 * SMS templates that still need it.
 */
export function buildLiveReadinessChecklist(input: {
  paidPlanActive: boolean;
  liveChannelsApproved: boolean;
  liveProviderDone: boolean;
  smsTemplateCount: number;
  smsTemplatesNeedingSetup: number;
  hasPlatformRoute: boolean;
}): LiveReadinessChecklistItem[] {
  const checklist: LiveReadinessChecklistItem[] = [];

  if (!input.hasPlatformRoute) {
    checklist.push({
      id: "paid_plan",
      label: input.liveChannelsApproved
        ? "Live messaging approved by platform"
        : "Activate a paid plan (Starter or Pro)",
      done: input.paidPlanActive || input.liveChannelsApproved,
      href: "/dashboard/settings/billing",
    });
  }

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
    paidPlanActive,
    liveChannelsApproved,
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
