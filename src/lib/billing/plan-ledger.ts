import {
  Channel,
  DealPaymentStatus,
  DealSource,
  SubscriptionPlan,
  SubscriptionStatus,
  type PrismaClient,
} from "@prisma/client";

import { prisma as defaultPrisma } from "@/lib/db";

export class PlanLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLedgerError";
  }
}

export type PlanDealSummary = {
  id: string;
  plan: SubscriptionPlan;
  source: "DIRECT" | "RAZORPAY";
  amountDuePaise: number;
  amountPaidPaise: number;
  paymentStatus: DealPaymentStatus;
  durationDays: number;
  contactLimit: number;
  /** Aggregate limit for STARTER/PRO deals; null for CUSTOM. */
  monthlyMessageLimit: number | null;
  /** Per-channel allocation, CUSTOM only; null for STARTER/PRO. */
  smsMonthlyLimit: number | null;
  whatsappMonthlyLimit: number | null;
  emailMonthlyLimit: number | null;
  resultingPaidUntil: string;
  activatedAt: string;
  createdByAdminName: string | null;
};

export type CustomPlanTopUpSummary = {
  id: string;
  channel: Channel;
  messagesAdded: number;
  resultingMonthlyLimit: number;
  amountDuePaise: number;
  amountPaidPaise: number;
  paymentStatus: DealPaymentStatus;
  createdAt: string;
  createdByAdminName: string | null;
};

export type PlanPaymentSummary = {
  id: string;
  amountPaise: number;
  note: string | null;
  createdAt: string;
  recordedByAdminName: string | null;
};

export type PlanLedger = {
  outstandingBalancePaise: number;
  deals: PlanDealSummary[];
  topUps: CustomPlanTopUpSummary[];
  payments: PlanPaymentSummary[];
};

/** Deal/top-up history, payment history, and outstanding balance for an org's plan billing. */
export async function getPlanLedgerForOrganization(
  organizationId: string,
  db: PrismaClient = defaultPrisma,
): Promise<PlanLedger> {
  const [deals, topUps, payments] = await Promise.all([
    db.planDeal.findMany({
      where: { organizationId },
      orderBy: { activatedAt: "desc" },
      include: { createdByAdmin: { select: { name: true } } },
    }),
    db.customPlanTopUp.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { createdByAdmin: { select: { name: true } } },
    }),
    db.planPayment.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { recordedByAdmin: { select: { name: true } } },
    }),
  ]);

  const outstandingFromDeals = deals.reduce(
    (total, deal) =>
      deal.paymentStatus === DealPaymentStatus.PAID
        ? total
        : total + (deal.amountDuePaise - deal.amountPaidPaise),
    0,
  );
  const outstandingFromTopUps = topUps.reduce(
    (total, topUp) =>
      topUp.paymentStatus === DealPaymentStatus.PAID
        ? total
        : total + (topUp.amountDuePaise - topUp.amountPaidPaise),
    0,
  );

  return {
    outstandingBalancePaise: outstandingFromDeals + outstandingFromTopUps,
    deals: deals.map((deal) => ({
      id: deal.id,
      plan: deal.plan,
      source: deal.source,
      amountDuePaise: deal.amountDuePaise,
      amountPaidPaise: deal.amountPaidPaise,
      paymentStatus: deal.paymentStatus,
      durationDays: deal.durationDays,
      contactLimit: deal.contactLimit,
      monthlyMessageLimit: deal.monthlyMessageLimit,
      smsMonthlyLimit: deal.smsMonthlyLimit,
      whatsappMonthlyLimit: deal.whatsappMonthlyLimit,
      emailMonthlyLimit: deal.emailMonthlyLimit,
      resultingPaidUntil: deal.resultingPaidUntil.toISOString(),
      activatedAt: deal.activatedAt.toISOString(),
      createdByAdminName: deal.createdByAdmin?.name ?? null,
    })),
    topUps: topUps.map((topUp) => ({
      id: topUp.id,
      channel: topUp.channel,
      messagesAdded: topUp.messagesAdded,
      resultingMonthlyLimit: topUp.resultingMonthlyLimit,
      amountDuePaise: topUp.amountDuePaise,
      amountPaidPaise: topUp.amountPaidPaise,
      paymentStatus: topUp.paymentStatus,
      createdAt: topUp.createdAt.toISOString(),
      createdByAdminName: topUp.createdByAdmin?.name ?? null,
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      amountPaise: payment.amountPaise,
      note: payment.note,
      createdAt: payment.createdAt.toISOString(),
      recordedByAdminName: payment.recordedByAdmin?.name ?? null,
    })),
  };
}

/**
 * Records a payment against an org's outstanding plan-deal balance and
 * allocates it FIFO across the org's oldest unpaid/partially-paid deals AND
 * top-ups together, ordered by date, regardless of which plan each deal
 * activated. Never touches Subscription.status/paidUntil/limits -- payment
 * settles the financial obligation only, independent of access.
 */
export async function recordPlanPayment(
  organizationId: string,
  amountPaise: number,
  note: string | undefined,
  recordedByAdminId: string,
  db: PrismaClient = defaultPrisma,
) {
  return db.$transaction(async (tx) => {
    const [unpaidDeals, unpaidTopUps] = await Promise.all([
      tx.planDeal.findMany({
        where: { organizationId, paymentStatus: { not: DealPaymentStatus.PAID } },
      }),
      tx.customPlanTopUp.findMany({
        where: { organizationId, paymentStatus: { not: DealPaymentStatus.PAID } },
      }),
    ]);

    const items = [
      ...unpaidDeals.map((deal) => ({
        kind: "DEAL" as const,
        id: deal.id,
        date: deal.activatedAt,
        amountDuePaise: deal.amountDuePaise,
        amountPaidPaise: deal.amountPaidPaise,
      })),
      ...unpaidTopUps.map((topUp) => ({
        kind: "TOP_UP" as const,
        id: topUp.id,
        date: topUp.createdAt,
        amountDuePaise: topUp.amountDuePaise,
        amountPaidPaise: topUp.amountPaidPaise,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let remaining = amountPaise;
    for (const item of items) {
      if (remaining <= 0) break;
      const owed = item.amountDuePaise - item.amountPaidPaise;
      if (owed <= 0) continue;

      const applied = Math.min(owed, remaining);
      const amountPaidPaise = item.amountPaidPaise + applied;
      const paymentStatus =
        amountPaidPaise >= item.amountDuePaise
          ? DealPaymentStatus.PAID
          : DealPaymentStatus.PARTIALLY_PAID;

      if (item.kind === "DEAL") {
        await tx.planDeal.update({
          where: { id: item.id },
          data: { amountPaidPaise, paymentStatus },
        });
      } else {
        await tx.customPlanTopUp.update({
          where: { id: item.id },
          data: { amountPaidPaise, paymentStatus },
        });
      }
      remaining -= applied;
    }

    return tx.planPayment.create({
      data: {
        organizationId,
        amountPaise,
        note: note?.trim() || null,
        recordedByAdminId,
      },
    });
  });
}

export type TopUpCustomPlanChannelInput = {
  organizationId: string;
  channel: Channel;
  messagesAdded: number;
  amountPaise: number;
  createdByAdminId: string;
};

/**
 * Increases a single channel's monthly ceiling for the org's *current*
 * CUSTOM period. Never touches paidUntil, status, contactLimit, or the other
 * two channels -- a top-up is not a renewal. Creates a financial obligation
 * (amountPaise) tracked in the same ledger/FIFO payment system as deals.
 */
export async function topUpCustomPlanChannel(
  input: TopUpCustomPlanChannelInput,
  db: PrismaClient = defaultPrisma,
) {
  return db.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { organizationId: input.organizationId },
    });

    if (!subscription) {
      throw new PlanLedgerError("Organization has no subscription");
    }
    if (subscription.plan !== SubscriptionPlan.CUSTOM) {
      throw new PlanLedgerError("Organization is not on a CUSTOM plan");
    }
    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new PlanLedgerError(
        "Organization's CUSTOM subscription is not active",
      );
    }
    if (!subscription.paidUntil || subscription.paidUntil <= new Date()) {
      throw new PlanLedgerError("Organization's CUSTOM plan has expired");
    }

    // Legacy-safe upsert: a brand-new row is seeded at the current aggregate
    // limit + messagesAdded (never smaller than what this channel already had
    // access to via aggregate fallback); an existing row just increments.
    const channelLimit = await tx.channelMessageLimit.upsert({
      where: {
        subscriptionId_channel: {
          subscriptionId: subscription.id,
          channel: input.channel,
        },
      },
      create: {
        subscriptionId: subscription.id,
        channel: input.channel,
        monthlyLimit: subscription.monthlyMessageLimit + input.messagesAdded,
      },
      update: { monthlyLimit: { increment: input.messagesAdded } },
    });

    // Dual-write: keeps Subscription.monthlyMessageLimit an accurate upper
    // bound, same invariant applyPlanDeal already maintains.
    await tx.subscription.update({
      where: { organizationId: input.organizationId },
      data: { monthlyMessageLimit: { increment: input.messagesAdded } },
    });

    const topUp = await tx.customPlanTopUp.create({
      data: {
        organizationId: input.organizationId,
        channel: input.channel,
        messagesAdded: input.messagesAdded,
        resultingMonthlyLimit: channelLimit.monthlyLimit,
        amountDuePaise: input.amountPaise,
        paymentStatus: DealPaymentStatus.UNPAID,
        source: DealSource.DIRECT,
        createdByAdminId: input.createdByAdminId,
      },
    });

    return { channelLimit, topUp };
  });
}
