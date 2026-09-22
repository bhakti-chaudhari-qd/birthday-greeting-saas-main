import {
  ChannelProvider,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";

import { ChannelConfigValidationError } from "@/lib/channel-config/errors";
import { prisma } from "@/lib/db";

const PAID_PLANS: ReadonlySet<SubscriptionPlan> = new Set([
  SubscriptionPlan.STARTER,
  SubscriptionPlan.PRO,
  SubscriptionPlan.CUSTOM,
]);

const LIVE_GATED_PROVIDERS: ReadonlySet<ChannelProvider> = new Set([
  ChannelProvider.CUSTOM_HTTP,
  ChannelProvider.META,
]);

/**
 * Live Custom HTTP / Meta Cloud API requires a paid ACTIVE plan
 * (or Platform Admin liveChannelsApproved). Org Owners only call this after RBAC.
 *
 * In automated Vitest suites, gate enforcement is opt-in via ABUSE_ENFORCE_LIVE_GATES=1
 * so existing provider/config tests keep using CUSTOM_HTTP fixtures.
 */
export async function assertLiveCustomHttpAllowed(input: {
  organizationId: string;
  userId?: string;
  provider: ChannelProvider;
}): Promise<void> {
  if (!LIVE_GATED_PROVIDERS.has(input.provider)) {
    return;
  }

  if (
    process.env.NODE_ENV === "test" &&
    process.env.ABUSE_ENFORCE_LIVE_GATES !== "1"
  ) {
    return;
  }

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    include: { subscription: true },
  });

  if (organization.liveChannelsApproved) {
    return;
  }

  const subscription = organization.subscription;
  const paidAndActive =
    subscription &&
    subscription.status === SubscriptionStatus.ACTIVE &&
    PAID_PLANS.has(subscription.plan);

  if (!paidAndActive) {
    throw new ChannelConfigValidationError(
      "Live WhatsApp/SMS providers require an active paid plan (STARTER, PRO, or CUSTOM), or Platform Admin approval",
    );
  }
}

/** Block insecure WhatsApp TLS when running in production. */
export function assertWhatsAppTlsAllowed(tlsInsecure: boolean): void {
  if (process.env.NODE_ENV === "production" && tlsInsecure) {
    throw new ChannelConfigValidationError(
      "Insecure TLS (tlsInsecure) is not allowed for WhatsApp in production",
    );
  }
}
