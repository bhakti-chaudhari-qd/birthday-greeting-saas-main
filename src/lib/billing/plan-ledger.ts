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
  recordedByAdminId: string | null,
  db: PrismaClient = defaultPrisma,
  options: { preferDealId?: string } = {},
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
    ].sort(
      (a, b) =>
        // A payment collected for one deal (its balance link) settles it first.
        Number(b.id === options.preferDealId) -
          Number(a.id === options.preferDealId) ||
        a.date.getTime() - b.date.getTime(),
    );

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

export type EditPlanDealInput = {
  organizationId: string;
  dealId: string;
  durationDays: number;
  amountPaise: number;
  contactLimit: number;
  /** STARTER/PRO only. */
  monthlyMessageLimit?: number;
  /** CUSTOM only. */
  smsMonthlyLimit?: number;
  whatsappMonthlyLimit?: number;
  emailMonthlyLimit?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dealPaymentStatusFor(
  amountPaidPaise: number,
  amountDuePaise: number,
): DealPaymentStatus {
  if (amountPaidPaise >= amountDuePaise) return DealPaymentStatus.PAID;
  if (amountPaidPaise > 0) return DealPaymentStatus.PARTIALLY_PAID;
  return DealPaymentStatus.UNPAID;
}

/**
 * Edits the org's current (most recent) plan deal in place and applies it to
 * access now. paidUntil moves by the change in duration, and message limits
 * move by the change in each limit, so channel top-ups already added this
 * period are kept. The amount only changes what the deal owes in the ledger;
 * it can't drop below what has already been paid.
 */
export async function editCurrentPlanDeal(
  input: EditPlanDealInput,
  db: PrismaClient = defaultPrisma,
  now: Date = new Date(),
) {
  return db.$transaction(async (tx) => {
    const deal = await tx.planDeal.findFirst({
      where: { id: input.dealId, organizationId: input.organizationId },
    });
    if (!deal) {
      throw new PlanLedgerError("Deal not found for this organization");
    }

    const latest = await tx.planDeal.findFirst({
      where: { organizationId: input.organizationId },
      orderBy: { activatedAt: "desc" },
      select: { id: true },
    });
    if (latest?.id !== deal.id) {
      throw new PlanLedgerError("Only the most recent deal can be edited");
    }

    const subscription = await tx.subscription.findUnique({
      where: { organizationId: input.organizationId },
      include: { channelLimits: true },
    });
    if (!subscription || subscription.plan !== deal.plan) {
      throw new PlanLedgerError(
        "This deal is no longer the client's current plan",
      );
    }

    if (input.amountPaise < deal.amountPaidPaise) {
      throw new PlanLedgerError(
        "Amount can't be less than what has already been paid on this deal",
      );
    }

    const shiftMs = (input.durationDays - deal.durationDays) * DAY_MS;
    const resultingPaidUntil = new Date(deal.resultingPaidUntil.getTime() + shiftMs);
    const paidUntil = new Date(
      (subscription.paidUntil ?? deal.resultingPaidUntil).getTime() + shiftMs,
    );
    if (paidUntil <= now) {
      throw new PlanLedgerError("The new duration would end the plan in the past");
    }

    let monthlyMessageLimit = subscription.monthlyMessageLimit;
    const isCustom = deal.plan === SubscriptionPlan.CUSTOM;

    if (isCustom) {
      if (
        input.smsMonthlyLimit == null ||
        input.whatsappMonthlyLimit == null ||
        input.emailMonthlyLimit == null
      ) {
        throw new PlanLedgerError("CUSTOM deals need SMS, WhatsApp and Email limits");
      }
      const allocations: Array<[Channel, number | null, number]> = [
        [Channel.SMS, deal.smsMonthlyLimit, input.smsMonthlyLimit],
        [Channel.WHATSAPP, deal.whatsappMonthlyLimit, input.whatsappMonthlyLimit],
        [Channel.EMAIL, deal.emailMonthlyLimit, input.emailMonthlyLimit],
      ];
      for (const [channel, previous, next] of allocations) {
        const delta = next - (previous ?? 0);
        const row = subscription.channelLimits.find((r) => r.channel === channel);
        if (row) {
          await tx.channelMessageLimit.update({
            where: { id: row.id },
            data: { monthlyLimit: Math.max(0, row.monthlyLimit + delta) },
          });
        } else {
          await tx.channelMessageLimit.create({
            data: { subscriptionId: subscription.id, channel, monthlyLimit: next },
          });
        }
        monthlyMessageLimit += delta;
      }
    } else {
      if (input.monthlyMessageLimit == null) {
        throw new PlanLedgerError("STARTER/PRO deals need a monthly message limit");
      }
      monthlyMessageLimit +=
        input.monthlyMessageLimit -
        (deal.monthlyMessageLimit ?? input.monthlyMessageLimit);
    }

    await tx.subscription.update({
      where: { organizationId: input.organizationId },
      data: {
        paidUntil,
        contactLimit: input.contactLimit,
        monthlyMessageLimit: Math.max(0, monthlyMessageLimit),
        // The expiry job marks lapsed plans PAST_DUE; extending one revives it.
        ...(subscription.status === SubscriptionStatus.PAST_DUE
          ? { status: SubscriptionStatus.ACTIVE }
          : {}),
      },
    });

    const updated = await tx.planDeal.update({
      where: { id: deal.id },
      data: {
        durationDays: input.durationDays,
        amountDuePaise: input.amountPaise,
        paymentStatus: dealPaymentStatusFor(deal.amountPaidPaise, input.amountPaise),
        contactLimit: input.contactLimit,
        resultingPaidUntil,
        ...(isCustom
          ? {
              smsMonthlyLimit: input.smsMonthlyLimit,
              whatsappMonthlyLimit: input.whatsappMonthlyLimit,
              emailMonthlyLimit: input.emailMonthlyLimit,
            }
          : { monthlyMessageLimit: input.monthlyMessageLimit }),
      },
    });

    return { before: deal, deal: updated };
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
