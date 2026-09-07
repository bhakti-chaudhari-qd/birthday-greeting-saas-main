import {
  Channel,
  DealPaymentStatus,
  DealSource,
  SubscriptionPlan,
  SubscriptionStatus,
  type PrismaClient,
  type Subscription,
} from "@prisma/client";

import {
  getCreditPackCatalogueEntry,
  getPlanCatalogueEntry,
  type CheckoutPlan,
  type CreditPackId,
} from "@/lib/billing/catalogue";
import { prisma as defaultPrisma } from "@/lib/db";

export const DEFAULT_PAID_PERIOD_DAYS = 30;

export function computePaidUntil(
  from: Date = new Date(),
  durationDays: number = DEFAULT_PAID_PERIOD_DAYS,
): Date {
  const days = Math.max(1, Math.min(366, durationDays));
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Renewal-safe paidUntil: extends from whichever is later, the existing
 * paidUntil or `from` -- so activating a deal before the current period ends
 * stacks on top of remaining time instead of resetting/shortening it.
 */
export function computeExtendedPaidUntil(
  existingPaidUntil: Date | null | undefined,
  from: Date,
  durationDays: number,
): Date {
  const base =
    existingPaidUntil && existingPaidUntil > from ? existingPaidUntil : from;
  return computePaidUntil(base, durationDays);
}

export type ApplyPaidPlanOptions = {
  paidUntil?: Date;
  razorpaySubscriptionId?: string | null;
  durationDays?: number;
};

export async function applyCheckoutPlanToOrganization(
  organizationId: string,
  plan: CheckoutPlan,
  db: PrismaClient = defaultPrisma,
  options: ApplyPaidPlanOptions = {},
) {
  const catalogue = await getPlanCatalogueEntry(plan, db);
  const paidUntil =
    options.paidUntil ??
    computePaidUntil(new Date(), options.durationDays ?? DEFAULT_PAID_PERIOD_DAYS);

  return db.subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      plan,
      status: SubscriptionStatus.ACTIVE,
      contactLimit: catalogue.contactLimit,
      monthlyMessageLimit: catalogue.monthlyMessageLimit,
      paidUntil,
      ...(options.razorpaySubscriptionId
        ? { razorpaySubscriptionId: options.razorpaySubscriptionId }
        : {}),
    },
    update: {
      plan,
      status: SubscriptionStatus.ACTIVE,
      contactLimit: catalogue.contactLimit,
      monthlyMessageLimit: catalogue.monthlyMessageLimit,
      paidUntil,
      ...(options.razorpaySubscriptionId !== undefined
        ? { razorpaySubscriptionId: options.razorpaySubscriptionId }
        : {}),
    },
  });
}

type ApplyPlanDealInput = {
  organizationId: string;
  plan: SubscriptionPlan;
  contactLimit: number;
  /** Aggregate monthly limit for STARTER/PRO; ignored (recomputed from the channel fields) for CUSTOM. */
  monthlyMessageLimit?: number;
  /** Per-channel allocation, CUSTOM only. */
  smsLimit?: number;
  whatsappLimit?: number;
  emailLimit?: number;
  durationDays: number;
  amountDuePaise: number;
  amountPaidPaise: number;
  paymentStatus: DealPaymentStatus;
  source: DealSource;
  billingCheckoutId?: string;
  createdByAdminId?: string | null;
  now?: Date;
  /** Bypasses the extend-from-existing computation with an exact value. */
  paidUntilOverride?: Date;
};

/**
 * Shared plan-deal mutator (STARTER/PRO/CUSTOM): activates/renews access
 * (Subscription, paidUntil extended from whatever it currently is; CUSTOM
 * also gets its ChannelMessageLimit rows) and records exactly one PlanDeal
 * ledger row for the activation. Activation/expiry are driven purely by
 * durationDays here; amountPaidPaise/paymentStatus only affect the ledger,
 * never Subscription.status/paidUntil. source/paymentStatus are generic
 * (DIRECT+UNPAID today; a future Razorpay-paid STARTER/PRO path could call
 * this with source: RAZORPAY, paymentStatus: PAID with no redesign needed).
 */
async function applyPlanDeal(
  input: ApplyPlanDealInput,
  db: PrismaClient = defaultPrisma,
) {
  const now = input.now ?? new Date();
  const isCustom = input.plan === SubscriptionPlan.CUSTOM;
  const monthlyMessageLimit = isCustom
    ? (input.smsLimit ?? 0) + (input.whatsappLimit ?? 0) + (input.emailLimit ?? 0)
    : (input.monthlyMessageLimit ?? 0);

  return db.$transaction(async (tx) => {
    const existing = await tx.subscription.findUnique({
      where: { organizationId: input.organizationId },
    });
    const paidUntil =
      input.paidUntilOverride ??
      computeExtendedPaidUntil(existing?.paidUntil, now, input.durationDays);

    const subscription = await tx.subscription.upsert({
      where: { organizationId: input.organizationId },
      create: {
        organizationId: input.organizationId,
        plan: input.plan,
        status: SubscriptionStatus.ACTIVE,
        contactLimit: input.contactLimit,
        monthlyMessageLimit,
        paidUntil,
      },
      update: {
        plan: input.plan,
        status: SubscriptionStatus.ACTIVE,
        contactLimit: input.contactLimit,
        monthlyMessageLimit,
        paidUntil,
      },
    });

    if (isCustom) {
      const allocations: Array<{ channel: Channel; monthlyLimit: number }> = [
        { channel: Channel.SMS, monthlyLimit: input.smsLimit ?? 0 },
        { channel: Channel.WHATSAPP, monthlyLimit: input.whatsappLimit ?? 0 },
        { channel: Channel.EMAIL, monthlyLimit: input.emailLimit ?? 0 },
      ];
      for (const allocation of allocations) {
        await tx.channelMessageLimit.upsert({
          where: {
            subscriptionId_channel: {
              subscriptionId: subscription.id,
              channel: allocation.channel,
            },
          },
          create: {
            subscriptionId: subscription.id,
            channel: allocation.channel,
            monthlyLimit: allocation.monthlyLimit,
          },
          update: { monthlyLimit: allocation.monthlyLimit },
        });
      }
    }

    const deal = await tx.planDeal.create({
      data: {
        organizationId: input.organizationId,
        plan: input.plan,
        source: input.source,
        amountDuePaise: input.amountDuePaise,
        amountPaidPaise: input.amountPaidPaise,
        paymentStatus: input.paymentStatus,
        durationDays: input.durationDays,
        contactLimit: input.contactLimit,
        monthlyMessageLimit: isCustom ? null : monthlyMessageLimit,
        smsMonthlyLimit: isCustom ? (input.smsLimit ?? 0) : null,
        whatsappMonthlyLimit: isCustom ? (input.whatsappLimit ?? 0) : null,
        emailMonthlyLimit: isCustom ? (input.emailLimit ?? 0) : null,
        resultingPaidUntil: paidUntil,
        billingCheckoutId: input.billingCheckoutId,
        createdByAdminId: input.createdByAdminId ?? null,
        activatedAt: now,
      },
    });

    return { subscription, deal };
  });
}

export type ActivatePlanDealDirectlyInput = {
  organizationId: string;
  plan: SubscriptionPlan;
  /** Required for CUSTOM; defaults to the catalogue price for STARTER/PRO. */
  amountPaise?: number;
  /** Required for CUSTOM; defaults to the catalogue limit for STARTER/PRO (admin may override). */
  contactLimit?: number;
  /** CUSTOM only. */
  smsMonthlyLimit?: number;
  whatsappMonthlyLimit?: number;
  emailMonthlyLimit?: number;
  durationDays?: number;
  createdByAdminId: string;
};

/**
 * Platform Admin activates (or renews) a plan deal immediately, without
 * waiting for payment. Access/expiry start now; the deal is recorded UNPAID
 * and settles later via recordPlanPayment, independent of access.
 */
export async function activatePlanDealDirectly(
  input: ActivatePlanDealDirectlyInput,
  db: PrismaClient = defaultPrisma,
) {
  const isCustom = input.plan === SubscriptionPlan.CUSTOM;

  let contactLimit: number;
  let monthlyMessageLimit: number | undefined;
  let amountPaise: number;

  if (isCustom) {
    if (
      input.contactLimit == null ||
      input.amountPaise == null ||
      input.smsMonthlyLimit == null ||
      input.whatsappMonthlyLimit == null ||
      input.emailMonthlyLimit == null
    ) {
      throw new Error(
        "CUSTOM activation requires amountPaise, contactLimit, and per-channel limits",
      );
    }
    contactLimit = input.contactLimit;
    amountPaise = input.amountPaise;
  } else {
    const catalogue = await getPlanCatalogueEntry(
      input.plan as CheckoutPlan,
      db,
    );
    contactLimit = input.contactLimit ?? catalogue.contactLimit;
    monthlyMessageLimit = catalogue.monthlyMessageLimit;
    amountPaise = input.amountPaise ?? catalogue.amountPaise ?? 0;
  }

  const { subscription, deal } = await applyPlanDeal(
    {
      organizationId: input.organizationId,
      plan: input.plan,
      contactLimit,
      monthlyMessageLimit,
      smsLimit: input.smsMonthlyLimit,
      whatsappLimit: input.whatsappMonthlyLimit,
      emailLimit: input.emailMonthlyLimit,
      durationDays: input.durationDays ?? DEFAULT_PAID_PERIOD_DAYS,
      amountDuePaise: amountPaise,
      amountPaidPaise: 0,
      paymentStatus: DealPaymentStatus.UNPAID,
      source: DealSource.DIRECT,
      createdByAdminId: input.createdByAdminId,
    },
    db,
  );
  return { subscription, deal };
}

export type ApplyPaymentLinkDealInput = {
  organizationId: string;
  plan: SubscriptionPlan;
  contactLimit: number;
  monthlyMessageLimit: number;
  /** Per-channel allocation for CUSTOM plans; ignored for other plans. */
  smsLimit?: number;
  whatsappLimit?: number;
  emailLimit?: number;
  durationDays?: number;
  paidUntil?: Date;
  /** CUSTOM plans only: the paid amount, recorded as a PAID PlanDeal row. */
  amountPaise?: number;
  billingCheckoutId?: string;
};

/** Apply a paid Admin payment-link deal (STARTER/PRO/CUSTOM with explicit limits). */
export async function applyPaymentLinkDealToOrganization(
  input: ApplyPaymentLinkDealInput,
  db: PrismaClient = defaultPrisma,
) {
  const durationDays = input.durationDays ?? DEFAULT_PAID_PERIOD_DAYS;

  if (
    input.plan === SubscriptionPlan.CUSTOM &&
    input.smsLimit != null &&
    input.whatsappLimit != null &&
    input.emailLimit != null &&
    input.amountPaise != null
  ) {
    const { subscription } = await applyPlanDeal(
      {
        organizationId: input.organizationId,
        plan: SubscriptionPlan.CUSTOM,
        contactLimit: input.contactLimit,
        smsLimit: input.smsLimit,
        whatsappLimit: input.whatsappLimit,
        emailLimit: input.emailLimit,
        durationDays,
        amountDuePaise: input.amountPaise,
        amountPaidPaise: input.amountPaise,
        paymentStatus: DealPaymentStatus.PAID,
        source: DealSource.RAZORPAY,
        billingCheckoutId: input.billingCheckoutId,
        paidUntilOverride: input.paidUntil,
      },
      db,
    );
    return subscription;
  }

  // Fallback: non-CUSTOM plans, or a CUSTOM deal missing full channel/amount
  // info -- preserves prior behavior (plain limits, extended paidUntil, no
  // ledger row) rather than silently dropping the deal. A future change could
  // route STARTER/PRO here through applyPlanDeal too (source: RAZORPAY,
  // paymentStatus: PAID) to give them a PlanDeal row -- no schema change
  // needed, applyPlanDeal is already plan- and source-agnostic.
  return db.$transaction(async (tx) => {
    const existing = await tx.subscription.findUnique({
      where: { organizationId: input.organizationId },
    });
    const paidUntil =
      input.paidUntil ??
      computeExtendedPaidUntil(existing?.paidUntil, new Date(), durationDays);

    const subscription = await tx.subscription.upsert({
      where: { organizationId: input.organizationId },
      create: {
        organizationId: input.organizationId,
        plan: input.plan,
        status: SubscriptionStatus.ACTIVE,
        contactLimit: input.contactLimit,
        monthlyMessageLimit: input.monthlyMessageLimit,
        paidUntil,
      },
      update: {
        plan: input.plan,
        status: SubscriptionStatus.ACTIVE,
        contactLimit: input.contactLimit,
        monthlyMessageLimit: input.monthlyMessageLimit,
        paidUntil,
      },
    });

    if (
      input.plan === SubscriptionPlan.CUSTOM &&
      input.smsLimit != null &&
      input.whatsappLimit != null &&
      input.emailLimit != null
    ) {
      const allocations: Array<{ channel: Channel; monthlyLimit: number }> = [
        { channel: Channel.SMS, monthlyLimit: input.smsLimit },
        { channel: Channel.WHATSAPP, monthlyLimit: input.whatsappLimit },
        { channel: Channel.EMAIL, monthlyLimit: input.emailLimit },
      ];

      for (const allocation of allocations) {
        await tx.channelMessageLimit.upsert({
          where: {
            subscriptionId_channel: {
              subscriptionId: subscription.id,
              channel: allocation.channel,
            },
          },
          create: {
            subscriptionId: subscription.id,
            channel: allocation.channel,
            monthlyLimit: allocation.monthlyLimit,
          },
          update: { monthlyLimit: allocation.monthlyLimit },
        });
      }
    }

    return subscription;
  });
}

/** Extend paidUntil after a successful recurring charge (does not change plan limits). */
export async function extendSubscriptionPaidUntil(
  organizationId: string,
  durationDays: number = DEFAULT_PAID_PERIOD_DAYS,
  db: PrismaClient = defaultPrisma,
  from: Date = new Date(),
) {
  const existing = await db.subscription.findUnique({
    where: { organizationId },
  });
  if (!existing) {
    throw new Error("Subscription not found for organization");
  }

  return db.subscription.update({
    where: { organizationId },
    data: {
      status: SubscriptionStatus.ACTIVE,
      paidUntil: computeExtendedPaidUntil(existing.paidUntil, from, durationDays),
    },
  });
}

/** Increment bonus credits from a paid pack (server catalogue amounts only). */
export async function applyCreditPackToOrganization(
  organizationId: string,
  packId: CreditPackId,
  db: PrismaClient = defaultPrisma,
) {
  const pack = getCreditPackCatalogueEntry(packId);
  const existing = await db.subscription.findUnique({
    where: { organizationId },
  });

  if (!existing) {
    throw new Error("Subscription not found for organization");
  }

  return db.subscription.update({
    where: { organizationId },
    data: {
      bonusMessageCredits: { increment: pack.messages },
    },
  });
}

export async function markSubscriptionPastDue(
  organizationId: string,
  db: PrismaClient = defaultPrisma,
) {
  const existing = await db.subscription.findUnique({
    where: { organizationId },
  });

  if (!existing) {
    return db.subscription.create({
      data: {
        organizationId,
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.PAST_DUE,
      },
    });
  }

  if (existing.status === SubscriptionStatus.CANCELLED) {
    return existing;
  }

  return db.subscription.update({
    where: { organizationId },
    data: { status: SubscriptionStatus.PAST_DUE },
  });
}

export async function markSubscriptionCancelled(
  organizationId: string,
  db: PrismaClient = defaultPrisma,
) {
  const existing = await db.subscription.findUnique({
    where: { organizationId },
  });

  if (!existing) {
    return db.subscription.create({
      data: {
        organizationId,
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.CANCELLED,
      },
    });
  }

  return db.subscription.update({
    where: { organizationId },
    data: {
      status: SubscriptionStatus.CANCELLED,
      razorpaySubscriptionId: null,
    },
  });
}

/**
 * Safety net when webhooks miss: ACTIVE subscriptions past paidUntil → PAST_DUE.
 * Rows with null paidUntil are left alone (FREE / not yet on paid billing).
 */
export async function expireOverduePaidSubscriptions(
  db: PrismaClient = defaultPrisma,
  now: Date = new Date(),
): Promise<{ expired: number; organizationIds: string[] }> {
  const overdue = await db.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      paidUntil: { lt: now },
      plan: { not: SubscriptionPlan.FREE },
    },
    select: { organizationId: true },
  });

  if (overdue.length === 0) {
    return { expired: 0, organizationIds: [] };
  }

  const organizationIds = overdue.map((row) => row.organizationId);
  await db.subscription.updateMany({
    where: { organizationId: { in: organizationIds } },
    data: { status: SubscriptionStatus.PAST_DUE },
  });

  return { expired: organizationIds.length, organizationIds };
}

export type { Subscription };
