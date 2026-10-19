import { Channel, SubscriptionPlan } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  getEffectiveMonthlyMessageLimit,
  isUsagePeriodStale,
} from "@/lib/queue/limits";

/** A paid plan ending within this many days shows on the admin overview. */
export const PLAN_EXPIRY_WARNING_DAYS = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ExpiringPlanAlert = {
  organizationId: string;
  organizationName: string;
  plan: SubscriptionPlan;
  paidUntil: string;
  /** Whole days left, rounded up: 1 means it ends within the next 24 hours. */
  daysLeft: number;
};

export type ExhaustedLimit = {
  /** "ALL" is the plan's single monthly limit shared by every channel. */
  channel: Channel | "ALL";
  used: number;
  limit: number;
};

export type ExhaustedChannelAlert = {
  organizationId: string;
  organizationName: string;
  plan: SubscriptionPlan;
  limits: ExhaustedLimit[];
};

export type PlatformPlanAlerts = {
  /** PLAN_EXPIRY_WARNING_DAYS, passed along for the overview heading. */
  warningDays: number;
  expiringPlans: ExpiringPlanAlert[];
  exhaustedChannels: ExhaustedChannelAlert[];
};

/**
 * Active clients whose paid plan ends in the next PLAN_EXPIRY_WARNING_DAYS,
 * and clients that have used up a monthly message limit. CUSTOM plans with
 * per-channel allocations are checked channel by channel; every other plan
 * has one shared limit. Usage from a previous IST month counts as zero, since
 * the counters only reset on the next send.
 */
export async function getPlatformPlanAlerts(
  now: Date = new Date(),
): Promise<PlatformPlanAlerts> {
  const organizations = await prisma.organization.findMany({
    where: { isActive: true, subscription: { isNot: null } },
    select: {
      id: true,
      name: true,
      subscription: {
        select: {
          plan: true,
          paidUntil: true,
          monthlyMessageLimit: true,
          bonusMessageCredits: true,
          messagesSentThisMonth: true,
          billingPeriodStart: true,
          channelLimits: {
            select: { channel: true, monthlyLimit: true, messagesSentThisMonth: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const warningEnd = now.getTime() + PLAN_EXPIRY_WARNING_DAYS * DAY_MS;
  const expiringPlans: ExpiringPlanAlert[] = [];
  const exhaustedChannels: ExhaustedChannelAlert[] = [];

  for (const organization of organizations) {
    const subscription = organization.subscription;
    if (!subscription) {
      continue;
    }

    const paidUntil = subscription.paidUntil?.getTime();
    if (
      subscription.plan !== SubscriptionPlan.FREE &&
      paidUntil !== undefined &&
      paidUntil > now.getTime() &&
      paidUntil <= warningEnd
    ) {
      expiringPlans.push({
        organizationId: organization.id,
        organizationName: organization.name,
        plan: subscription.plan,
        paidUntil: subscription.paidUntil!.toISOString(),
        daysLeft: Math.ceil((paidUntil - now.getTime()) / DAY_MS),
      });
    }

    if (isUsagePeriodStale(subscription.billingPeriodStart, now)) {
      continue;
    }

    const limits: ExhaustedLimit[] = [];
    if (
      subscription.plan === SubscriptionPlan.CUSTOM &&
      subscription.channelLimits.length > 0
    ) {
      for (const row of subscription.channelLimits) {
        if (row.monthlyLimit > 0 && row.messagesSentThisMonth >= row.monthlyLimit) {
          limits.push({
            channel: row.channel,
            used: row.messagesSentThisMonth,
            limit: row.monthlyLimit,
          });
        }
      }
    } else {
      const limit = getEffectiveMonthlyMessageLimit(subscription);
      if (limit > 0 && subscription.messagesSentThisMonth >= limit) {
        limits.push({
          channel: "ALL",
          used: subscription.messagesSentThisMonth,
          limit,
        });
      }
    }

    if (limits.length > 0) {
      exhaustedChannels.push({
        organizationId: organization.id,
        organizationName: organization.name,
        plan: subscription.plan,
        limits,
      });
    }
  }

  expiringPlans.sort((a, b) => a.paidUntil.localeCompare(b.paidUntil));

  return {
    warningDays: PLAN_EXPIRY_WARNING_DAYS,
    expiringPlans,
    exhaustedChannels,
  };
}
