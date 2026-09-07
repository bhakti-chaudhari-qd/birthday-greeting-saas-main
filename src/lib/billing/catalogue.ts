import { SubscriptionPlan, type PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "@/lib/db";

export type CheckoutPlan = typeof SubscriptionPlan.STARTER | typeof SubscriptionPlan.PRO;

export type PlanCatalogueEntry = {
  plan: SubscriptionPlan;
  label: string;
  description: string;
  /** Amount charged via Razorpay in paise (INR). Null for FREE/CUSTOM. */
  amountPaise: number | null;
  currency: "INR";
  contactLimit: number;
  monthlyMessageLimit: number;
  /** True when Organization Owners can self-serve checkout for this plan. */
  checkoutEnabled: boolean;
};

export type CreditPackId = "credits-5k" | "credits-25k";

export type CreditPackCatalogueEntry = {
  id: CreditPackId;
  label: string;
  description: string;
  messages: number;
  amountPaise: number;
  currency: "INR";
};

/**
 * Server-side source of truth for plan limits and Razorpay amounts.
 * Never trust client-supplied price or limits.
 */
export const PLAN_CATALOGUE: Record<SubscriptionPlan, PlanCatalogueEntry> = {
  FREE: {
    plan: SubscriptionPlan.FREE,
    label: "Free",
    description: "Get started with contacts and TEST-channel messaging.",
    amountPaise: null,
    currency: "INR",
    contactLimit: 500,
    monthlyMessageLimit: 500,
    checkoutEnabled: false,
  },
  STARTER: {
    plan: SubscriptionPlan.STARTER,
    label: "Starter",
    description: "Higher limits and live Custom HTTP when ACTIVE.",
    amountPaise: 499_00,
    currency: "INR",
    contactLimit: 1_000,
    monthlyMessageLimit: 10_000,
    checkoutEnabled: true,
  },
  PRO: {
    plan: SubscriptionPlan.PRO,
    label: "Pro",
    description: "Higher monthly send capacity for growing teams.",
    amountPaise: 1_499_00,
    currency: "INR",
    contactLimit: 10_000,
    monthlyMessageLimit: 100_000,
    checkoutEnabled: true,
  },
  CUSTOM: {
    plan: SubscriptionPlan.CUSTOM,
    label: "Custom",
    description: "Negotiated limits - managed by Platform Admin only.",
    amountPaise: null,
    currency: "INR",
    contactLimit: 50_000,
    monthlyMessageLimit: 50_000,
    checkoutEnabled: false,
  },
};

/**
 * One-time message packs for the current IST usage month.
 * Added to Subscription.bonusMessageCredits after Razorpay payment.
 */
export const CREDIT_PACK_CATALOGUE: Record<
  CreditPackId,
  CreditPackCatalogueEntry
> = {
  "credits-5k": {
    id: "credits-5k",
    label: "5,000 extra messages",
    description: "Add-on for this month when you hit your plan send limit.",
    messages: 5_000,
    amountPaise: 299_00,
    currency: "INR",
  },
  "credits-25k": {
    id: "credits-25k",
    label: "25,000 extra messages",
    description: "Larger add-on for busy months.",
    messages: 25_000,
    amountPaise: 999_00,
    currency: "INR",
  },
};

export const CREDIT_PACK_IDS = Object.keys(
  CREDIT_PACK_CATALOGUE,
) as CreditPackId[];

/**
 * STARTER/PRO are admin-editable and read from PlanCatalogueRecord; FREE/CUSTOM
 * are not editable and resolve immediately from the hardcoded defaults above.
 * Falls back to the hardcoded default if a STARTER/PRO row is ever missing.
 */
export async function getPlanCatalogueEntry(
  plan: SubscriptionPlan,
  db: PrismaClient = defaultPrisma,
): Promise<PlanCatalogueEntry> {
  if (plan !== SubscriptionPlan.STARTER && plan !== SubscriptionPlan.PRO) {
    return PLAN_CATALOGUE[plan];
  }

  const record = await db.planCatalogueRecord.findUnique({ where: { plan } });
  if (!record) {
    return PLAN_CATALOGUE[plan];
  }

  return {
    plan: record.plan,
    label: record.label,
    description: record.description,
    amountPaise: record.amountPaise,
    currency: "INR",
    contactLimit: record.contactLimit,
    monthlyMessageLimit: record.monthlyMessageLimit,
    checkoutEnabled: PLAN_CATALOGUE[plan].checkoutEnabled,
  };
}

export function isCheckoutPlan(plan: string): plan is CheckoutPlan {
  return plan === SubscriptionPlan.STARTER || plan === SubscriptionPlan.PRO;
}

export async function listCheckoutPlans(
  db: PrismaClient = defaultPrisma,
): Promise<PlanCatalogueEntry[]> {
  return Promise.all([
    getPlanCatalogueEntry(SubscriptionPlan.STARTER, db),
    getPlanCatalogueEntry(SubscriptionPlan.PRO, db),
  ]);
}

export function isCreditPackId(packId: string): packId is CreditPackId {
  return Object.prototype.hasOwnProperty.call(CREDIT_PACK_CATALOGUE, packId);
}

export function getCreditPackCatalogueEntry(
  packId: CreditPackId,
): CreditPackCatalogueEntry {
  return CREDIT_PACK_CATALOGUE[packId];
}

export function listCreditPacks(): CreditPackCatalogueEntry[] {
  return CREDIT_PACK_IDS.map((id) => CREDIT_PACK_CATALOGUE[id]);
}

/** Paid plans that may purchase mid-month credit packs. */
export function canPurchaseCreditPacks(subscription: {
  plan: SubscriptionPlan;
  status: string;
}): boolean {
  if (subscription.status !== "ACTIVE") {
    return false;
  }
  return (
    subscription.plan === SubscriptionPlan.STARTER ||
    subscription.plan === SubscriptionPlan.PRO ||
    subscription.plan === SubscriptionPlan.CUSTOM
  );
}

/** Live STARTER/PRO labels keyed by plan, e.g. from listPlanCatalogueEntriesForPlatformAdmin(). */
export type PlanLabelMap = Partial<Record<string, string>>;

/**
 * Resolves a plan's current display name: the live (admin-editable) label
 * for STARTER/PRO when available, the hardcoded default label otherwise
 * (FREE/CUSTOM are never editable), or the raw value as a last-resort
 * fallback for an unrecognized/null plan.
 */
export function getPlanDisplayLabel(
  plan: string | null | undefined,
  liveLabels?: PlanLabelMap,
): string {
  if (!plan) {
    return "None";
  }
  if (
    (plan === SubscriptionPlan.STARTER || plan === SubscriptionPlan.PRO) &&
    liveLabels?.[plan]
  ) {
    return liveLabels[plan]!;
  }
  if (plan in PLAN_CATALOGUE) {
    return PLAN_CATALOGUE[plan as SubscriptionPlan].label;
  }
  return plan;
}

export function formatInrFromPaise(amountPaise: number): string {
  const rupees = amountPaise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}
