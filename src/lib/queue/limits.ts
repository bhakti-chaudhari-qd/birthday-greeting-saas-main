import {
  Channel,
  SubscriptionPlan,
  type ChannelMessageLimit,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  formatIsoDate,
  getOrganizationLocalIsoDate,
  parseTargetDate,
} from "@/lib/queue/dates";

import { USAGE_PERIOD_TIMEZONE } from "./constants";
import { QueueValidationError } from "./errors";

export type UsagePeriodBounds = {
  periodStart: Date;
  periodEnd: Date;
  periodKey: string;
};

export type MonthlySendCapacitySubscription = {
  monthlyMessageLimit: number;
  bonusMessageCredits?: number | null;
  messagesSentThisMonth: number;
};

/**
 * Per-channel monthly allocation for CUSTOM plan subscriptions, keyed by
 * channel. Absence of a channel's row means that channel falls back to the
 * aggregate Subscription limit (see getRemainingCapacityForChannel).
 */
export type ChannelLimitsMap = Map<Channel, ChannelMessageLimit>;

/**
 * Returns inclusive start and exclusive end of the Asia/Kolkata calendar month
 * containing referenceDate, as UTC midnight Date values (YYYY-MM-DD style).
 */
export function getIstUsagePeriodBounds(
  referenceDate: Date = new Date(),
): UsagePeriodBounds {
  const isoDate = getOrganizationLocalIsoDate(
    USAGE_PERIOD_TIMEZONE,
    referenceDate,
  );
  const { year, month } = parseTargetDate(isoDate);
  const periodKey = `${year}-${String(month).padStart(2, "0")}`;
  const periodStart = parseTargetDate(formatIsoDate(year, month, 1)).date;

  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  const periodEnd = parseTargetDate(formatIsoDate(nextYear, nextMonth, 1)).date;

  return { periodStart, periodEnd, periodKey };
}

export function getIstMonthKey(date: Date): string {
  const isoDate = getOrganizationLocalIsoDate(USAGE_PERIOD_TIMEZONE, date);
  const { year, month } = parseTargetDate(isoDate);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function isUsagePeriodStale(
  billingPeriodStart: Date,
  referenceDate: Date = new Date(),
): boolean {
  return getIstMonthKey(billingPeriodStart) !== getIstMonthKey(referenceDate);
}

/** Plan catalogue limit plus purchased bonus credits for the current usage month. */
export function getEffectiveMonthlyMessageLimit(
  subscription: Pick<
    MonthlySendCapacitySubscription,
    "monthlyMessageLimit" | "bonusMessageCredits"
  >,
): number {
  const bonus = Math.max(0, subscription.bonusMessageCredits ?? 0);
  return Math.max(0, subscription.monthlyMessageLimit) + bonus;
}

/** One query per transaction; loads a subscription's per-channel allocations. */
export async function loadChannelLimits(
  tx: Prisma.TransactionClient,
  subscriptionId: string,
): Promise<ChannelLimitsMap> {
  const rows = await tx.channelMessageLimit.findMany({
    where: { subscriptionId },
  });

  return new Map(rows.map((row) => [row.channel, row]));
}

/**
 * Locks the subscription row and lazily resets monthly usage (aggregate and,
 * for CUSTOM plans, per-channel) when the stored IST usage-period watermark
 * is stale. Callers must reserve capacity in the same transaction after this
 * returns. Also loads channelLimits so callers need no extra query.
 */
export async function lockSubscriptionForQueueGeneration(
  organizationId: string,
  tx: Prisma.TransactionClient = prisma,
  referenceDate: Date = new Date(),
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Subscription"
    WHERE "organizationId" = ${organizationId}
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new QueueValidationError("Subscription not found for organization");
  }

  let subscription = await tx.subscription.findUniqueOrThrow({
    where: { organizationId },
  });

  if (isUsagePeriodStale(subscription.billingPeriodStart, referenceDate)) {
    const bounds = getIstUsagePeriodBounds(referenceDate);
    subscription = await tx.subscription.update({
      where: { organizationId },
      data: {
        messagesSentThisMonth: 0,
        bonusMessageCredits: 0,
        billingPeriodStart: bounds.periodStart,
        billingPeriodEnd: bounds.periodEnd,
      },
    });
    await tx.channelMessageLimit.updateMany({
      where: { subscriptionId: subscription.id },
      data: { messagesSentThisMonth: 0 },
    });
  }

  const { assertSubscriptionAllowsSending } = await import(
    "@/lib/abuse/subscription-send"
  );
  assertSubscriptionAllowsSending(subscription);

  const channelLimits = await loadChannelLimits(tx, subscription.id);

  return { subscription, channelLimits };
}

export function getRemainingMonthlySendCapacity(
  subscription: MonthlySendCapacitySubscription,
) {
  return Math.max(
    0,
    getEffectiveMonthlyMessageLimit(subscription) -
      subscription.messagesSentThisMonth,
  );
}

/**
 * Remaining send capacity for a channel. CUSTOM plan subscriptions with a
 * ChannelMessageLimit row for this channel enforce that row's own allocation;
 * every other case (non-CUSTOM plans, or CUSTOM subscriptions that haven't
 * been given per-channel rows yet) falls back to the aggregate counter,
 * tracked by the caller as aggregateRemaining, unchanged from today.
 */
export function getRemainingCapacityForChannel(
  subscription: { plan: SubscriptionPlan },
  channelLimits: ChannelLimitsMap,
  channel: Channel,
  aggregateRemaining: number,
): number {
  if (subscription.plan === SubscriptionPlan.CUSTOM) {
    const channelLimit = channelLimits.get(channel);
    if (channelLimit) {
      return Math.max(
        0,
        channelLimit.monthlyLimit - channelLimit.messagesSentThisMonth,
      );
    }
  }

  return aggregateRemaining;
}

/**
 * Records a reserved send: always increments the aggregate counter (kept
 * accurate for dashboards/alerts that only read the aggregate), and for
 * CUSTOM plans with a matching channel row, also increments that row so
 * subsequent getRemainingCapacityForChannel calls in the same transaction
 * see the updated per-channel usage.
 */
export async function incrementSendUsage(
  tx: Prisma.TransactionClient,
  subscription: { organizationId: string; plan: SubscriptionPlan },
  channelLimits: ChannelLimitsMap,
  channel: Channel,
): Promise<void> {
  await tx.subscription.update({
    where: { organizationId: subscription.organizationId },
    data: { messagesSentThisMonth: { increment: 1 } },
  });

  if (subscription.plan === SubscriptionPlan.CUSTOM) {
    const channelLimit = channelLimits.get(channel);
    if (channelLimit) {
      await tx.channelMessageLimit.update({
        where: { id: channelLimit.id },
        data: { messagesSentThisMonth: { increment: 1 } },
      });
      channelLimit.messagesSentThisMonth += 1;
    }
  }
}

export async function reserveMonthlySendCapacity(
  organizationId: string,
  tx: Prisma.TransactionClient,
  referenceDate: Date = new Date(),
) {
  const { subscription } = await lockSubscriptionForQueueGeneration(
    organizationId,
    tx,
    referenceDate,
  );
  const remaining = getRemainingMonthlySendCapacity(subscription);

  if (remaining <= 0) {
    return { reserved: false, remaining: 0 };
  }

  await tx.subscription.update({
    where: { organizationId },
    data: {
      messagesSentThisMonth: { increment: 1 },
    },
  });

  return { reserved: true, remaining: remaining - 1 };
}
