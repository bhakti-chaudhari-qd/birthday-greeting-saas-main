import type { CheckoutPlan } from "@/lib/billing/catalogue";
import { getPlanCatalogueEntry } from "@/lib/billing/catalogue";
import {
  createRazorpayPlan,
  requireRazorpayCredentials,
  type RazorpayCredentials,
} from "@/lib/billing/razorpay";

type CachedPlan = { amountPaise: number; id: string };

const planIdCache: Partial<Record<CheckoutPlan, CachedPlan>> = {};

function envPlanId(plan: CheckoutPlan): string | undefined {
  const raw =
    plan === "STARTER"
      ? process.env.RAZORPAY_PLAN_STARTER
      : process.env.RAZORPAY_PLAN_PRO;
  return raw?.trim() || undefined;
}

/**
 * Resolve a Razorpay Plan id for STARTER/PRO.
 * Prefer RAZORPAY_PLAN_STARTER / RAZORPAY_PLAN_PRO (an explicit pin -- editing
 * the catalogue price never overrides it). Otherwise cache a created Razorpay
 * Plan per process, keyed to the catalogue amount at creation time, so a price
 * edit in the admin catalogue creates (and caches) a fresh Plan on next resolve
 * instead of silently keeping the old price.
 */
export async function resolveRazorpayPlanId(
  plan: CheckoutPlan,
  credentials: RazorpayCredentials = requireRazorpayCredentials(),
): Promise<string> {
  const fromEnv = envPlanId(plan);
  if (fromEnv) {
    return fromEnv;
  }

  const catalogue = await getPlanCatalogueEntry(plan);
  if (catalogue.amountPaise == null) {
    throw new Error(`Plan ${plan} is not priced for Razorpay subscriptions`);
  }

  const cached = planIdCache[plan];
  if (cached && cached.amountPaise === catalogue.amountPaise) {
    return cached.id;
  }

  const created = await createRazorpayPlan(
    {
      name: `Birthday Greeting ${catalogue.label}`,
      amountPaise: catalogue.amountPaise,
      currency: "INR",
    },
    credentials,
  );
  planIdCache[plan] = { amountPaise: catalogue.amountPaise, id: created.id };
  return created.id;
}
