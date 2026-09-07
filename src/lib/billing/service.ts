import {
  SubscriptionPlan,
  SubscriptionStatus,
  type PrismaClient,
} from "@prisma/client";

import {
  DEFAULT_PAID_PERIOD_DAYS,
  applyCheckoutPlanToOrganization,
  applyCreditPackToOrganization,
  applyPaymentLinkDealToOrganization,
} from "@/lib/billing/apply-plan";
import {
  canPurchaseCreditPacks,
  getCreditPackCatalogueEntry,
  getPlanCatalogueEntry,
  isCheckoutPlan,
  isCreditPackId,
  listCheckoutPlans,
  listCreditPacks,
  type CheckoutPlan,
  type CreditPackId,
} from "@/lib/billing/catalogue";
import {
  BillingNotConfiguredError,
  cancelRazorpayPaymentLink,
  createRazorpayOrder,
  createRazorpayPaymentLink,
  createRazorpaySubscription,
  requireRazorpayCredentials,
  verifyRazorpayPaymentSignature,
  verifyRazorpaySubscriptionPaymentSignature,
} from "@/lib/billing/razorpay";
import { resolveRazorpayPlanId } from "@/lib/billing/razorpay-plans";
import { prisma as defaultPrisma } from "@/lib/db";

export class BillingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingValidationError";
  }
}

export class ActivePlanRenewalConfirmationRequiredError extends Error {
  constructor(
    message = "This organization already has an active plan. Pass confirmRenewal=true to acknowledge creating a new payment link for it.",
  ) {
    super(message);
    this.name = "ActivePlanRenewalConfirmationRequiredError";
  }
}

export async function getBillingOverview(
  organizationId: string,
  db: PrismaClient = defaultPrisma,
) {
  const subscription = await db.subscription.findUnique({
    where: { organizationId },
    include: { channelLimits: true },
  });

  const freeCatalogueEntry = await getPlanCatalogueEntry(
    SubscriptionPlan.FREE,
    db,
  );

  const effective = subscription ?? {
    plan: SubscriptionPlan.FREE,
    status: "ACTIVE" as const,
    contactLimit: freeCatalogueEntry.contactLimit,
    monthlyMessageLimit: freeCatalogueEntry.monthlyMessageLimit,
    bonusMessageCredits: 0,
    messagesSentThisMonth: 0,
    billingPeriodStart: new Date(),
    billingPeriodEnd: null as Date | null,
    paidUntil: null as Date | null,
  };

  let billingReady = false;
  try {
    requireRazorpayCredentials();
    billingReady = true;
  } catch (error) {
    if (!(error instanceof BillingNotConfiguredError)) {
      throw error;
    }
  }

  const bonusMessageCredits = effective.bonusMessageCredits ?? 0;
  const effectiveMonthlyMessageLimit =
    effective.monthlyMessageLimit + bonusMessageCredits;
  const creditsCheckoutEnabled =
    billingReady && canPurchaseCreditPacks(effective);
  const channelBreakdown = (subscription?.channelLimits ?? []).map((limit) => ({
    channel: limit.channel,
    monthlyLimit: limit.monthlyLimit,
    messagesSentThisMonth: limit.messagesSentThisMonth,
  }));

  return {
    billingReady,
    subscription: {
      plan: effective.plan,
      status: effective.status,
      contactLimit: effective.contactLimit,
      monthlyMessageLimit: effective.monthlyMessageLimit,
      bonusMessageCredits,
      effectiveMonthlyMessageLimit,
      messagesSentThisMonth: effective.messagesSentThisMonth,
      /** Per-channel allocation for CUSTOM plans; empty when using the aggregate limit. */
      channelBreakdown,
      billingPeriodStart: effective.billingPeriodStart.toISOString(),
      billingPeriodEnd: effective.billingPeriodEnd
        ? effective.billingPeriodEnd.toISOString()
        : null,
      paidUntil: effective.paidUntil
        ? effective.paidUntil.toISOString()
        : null,
    },
    catalogue: [
      freeCatalogueEntry,
      ...(await listCheckoutPlans(db)),
      await getPlanCatalogueEntry(SubscriptionPlan.CUSTOM, db),
    ].map((entry) => ({
      plan: entry.plan,
      label: entry.label,
      description: entry.description,
      amountPaise: entry.amountPaise,
      currency: entry.currency,
      contactLimit: entry.contactLimit,
      monthlyMessageLimit: entry.monthlyMessageLimit,
      checkoutEnabled: entry.checkoutEnabled && billingReady,
    })),
    creditPacks: listCreditPacks().map((pack) => ({
      id: pack.id,
      label: pack.label,
      description: pack.description,
      messages: pack.messages,
      amountPaise: pack.amountPaise,
      currency: pack.currency,
      checkoutEnabled: creditsCheckoutEnabled,
    })),
  };
}

export async function createCheckoutOrder(input: {
  organizationId: string;
  plan: string;
  db?: PrismaClient;
}) {
  const db = input.db ?? defaultPrisma;

  if (!isCheckoutPlan(input.plan)) {
    throw new BillingValidationError(
      "Only STARTER and PRO plans can be purchased via checkout. CUSTOM is Platform Admin only.",
    );
  }

  const plan = input.plan as CheckoutPlan;
  const catalogue = await getPlanCatalogueEntry(plan, db);
  if (catalogue.amountPaise == null) {
    throw new BillingValidationError("Selected plan is not priced for checkout.");
  }

  const credentials = requireRazorpayCredentials();
  const notes = {
    organizationId: input.organizationId,
    kind: "PLAN",
    plan,
  };

  try {
    const razorpayPlanId = await resolveRazorpayPlanId(plan, credentials);
    const subscription = await createRazorpaySubscription(
      {
        planId: razorpayPlanId,
        notes,
      },
      credentials,
    );

    const placeholderOrderId = `sub_${subscription.id}`;
    await db.billingCheckout.create({
      data: {
        organizationId: input.organizationId,
        kind: "PLAN",
        plan,
        razorpayOrderId: placeholderOrderId,
        razorpaySubscriptionId: subscription.id,
        amountPaise: catalogue.amountPaise,
        currency: "INR",
        durationDays: DEFAULT_PAID_PERIOD_DAYS,
        status: "CREATED",
      },
    });

    return {
      kind: "PLAN" as const,
      mode: "subscription" as const,
      subscriptionId: subscription.id,
      orderId: placeholderOrderId,
      amount: catalogue.amountPaise,
      currency: "INR" as const,
      keyId: credentials.keyId,
      plan,
      label: catalogue.label,
    };
  } catch (error) {
    // Fall back to one-time order (still sets paidUntil on confirm).
    console.error(
      "Razorpay subscription create failed; falling back to one-time order",
      error,
    );
  }

  const receipt = `org_${input.organizationId.slice(0, 8)}_${Date.now()}`
    .slice(0, 40);

  const order = await createRazorpayOrder(
    {
      amountPaise: catalogue.amountPaise,
      currency: "INR",
      receipt,
      notes,
    },
    credentials,
  );

  await db.billingCheckout.create({
    data: {
      organizationId: input.organizationId,
      kind: "PLAN",
      plan,
      razorpayOrderId: order.id,
      amountPaise: catalogue.amountPaise,
      currency: "INR",
      durationDays: DEFAULT_PAID_PERIOD_DAYS,
      status: "CREATED",
    },
  });

  return {
    kind: "PLAN" as const,
    mode: "order" as const,
    orderId: order.id,
    amount: catalogue.amountPaise,
    currency: "INR" as const,
    keyId: credentials.keyId,
    plan,
    label: catalogue.label,
  };
}

export async function createCreditCheckoutOrder(input: {
  organizationId: string;
  packId: string;
  db?: PrismaClient;
}) {
  const db = input.db ?? defaultPrisma;

  if (!isCreditPackId(input.packId)) {
    throw new BillingValidationError("Unknown credit pack.");
  }

  const packId = input.packId;
  const pack = getCreditPackCatalogueEntry(packId);
  const subscription = await db.subscription.findUnique({
    where: { organizationId: input.organizationId },
  });

  if (!subscription || !canPurchaseCreditPacks(subscription)) {
    throw new BillingValidationError(
      "Extra message packs require an ACTIVE STARTER, PRO, or CUSTOM plan.",
    );
  }

  const credentials = requireRazorpayCredentials();
  const receipt = `crd_${input.organizationId.slice(0, 8)}_${Date.now()}`.slice(
    0,
    40,
  );

  const order = await createRazorpayOrder(
    {
      amountPaise: pack.amountPaise,
      currency: "INR",
      receipt,
      notes: {
        organizationId: input.organizationId,
        kind: "CREDITS",
        packId,
      },
    },
    credentials,
  );

  await db.billingCheckout.create({
    data: {
      organizationId: input.organizationId,
      kind: "CREDITS",
      plan: null,
      creditMessages: pack.messages,
      razorpayOrderId: order.id,
      amountPaise: pack.amountPaise,
      currency: "INR",
      status: "CREATED",
    },
  });

  return {
    kind: "CREDITS" as const,
    orderId: order.id,
    amount: pack.amountPaise,
    currency: "INR" as const,
    keyId: credentials.keyId,
    packId,
    label: pack.label,
    messages: pack.messages,
  };
}

export async function confirmCheckoutPayment(input: {
  organizationId: string;
  plan: string;
  orderId?: string;
  subscriptionId?: string;
  paymentId: string;
  signature: string;
  db?: PrismaClient;
}) {
  const db = input.db ?? defaultPrisma;

  if (!isCheckoutPlan(input.plan)) {
    throw new BillingValidationError("Invalid plan for confirm.");
  }

  const credentials = requireRazorpayCredentials();

  const checkout = input.subscriptionId
    ? await db.billingCheckout.findFirst({
        where: {
          organizationId: input.organizationId,
          razorpaySubscriptionId: input.subscriptionId,
          kind: "PLAN",
        },
        orderBy: { createdAt: "desc" },
      })
    : input.orderId
      ? await db.billingCheckout.findUnique({
          where: { razorpayOrderId: input.orderId },
        })
      : null;

  if (!checkout || checkout.organizationId !== input.organizationId) {
    throw new BillingValidationError(
      "Checkout order not found for this organization.",
    );
  }

  if (checkout.kind !== "PLAN") {
    throw new BillingValidationError("Checkout order is not a plan purchase.");
  }

  if (checkout.plan == null || checkout.plan !== input.plan) {
    throw new BillingValidationError("Plan does not match the checkout order.");
  }

  const valid = checkout.razorpaySubscriptionId
    ? verifyRazorpaySubscriptionPaymentSignature({
        paymentId: input.paymentId,
        subscriptionId: checkout.razorpaySubscriptionId,
        signature: input.signature,
        keySecret: credentials.keySecret,
      })
    : input.orderId
      ? verifyRazorpayPaymentSignature({
          orderId: input.orderId,
          paymentId: input.paymentId,
          signature: input.signature,
          keySecret: credentials.keySecret,
        })
      : false;

  if (!valid) {
    throw new BillingValidationError("Invalid payment signature.");
  }

  if (checkout.status === "PAID") {
    return db.subscription.findUniqueOrThrow({
      where: { organizationId: input.organizationId },
    });
  }

  const subscription = await applyCheckoutPlanToOrganization(
    input.organizationId,
    input.plan,
    db,
    {
      durationDays: checkout.durationDays ?? DEFAULT_PAID_PERIOD_DAYS,
      razorpaySubscriptionId: checkout.razorpaySubscriptionId,
    },
  );

  await db.billingCheckout.update({
    where: { id: checkout.id },
    data: {
      status: "PAID",
      razorpayPaymentId: input.paymentId,
    },
  });

  return subscription;
}

export async function confirmCreditCheckoutPayment(input: {
  organizationId: string;
  packId: string;
  orderId: string;
  paymentId: string;
  signature: string;
  db?: PrismaClient;
}) {
  const db = input.db ?? defaultPrisma;

  if (!isCreditPackId(input.packId)) {
    throw new BillingValidationError("Invalid credit pack for confirm.");
  }

  const packId: CreditPackId = input.packId;
  const pack = getCreditPackCatalogueEntry(packId);

  const credentials = requireRazorpayCredentials();
  const valid = verifyRazorpayPaymentSignature({
    orderId: input.orderId,
    paymentId: input.paymentId,
    signature: input.signature,
    keySecret: credentials.keySecret,
  });

  if (!valid) {
    throw new BillingValidationError("Invalid payment signature.");
  }

  const checkout = await db.billingCheckout.findUnique({
    where: { razorpayOrderId: input.orderId },
  });

  if (!checkout || checkout.organizationId !== input.organizationId) {
    throw new BillingValidationError("Checkout order not found for this organization.");
  }

  if (checkout.kind !== "CREDITS") {
    throw new BillingValidationError("Checkout order is not a credit pack purchase.");
  }

  if (checkout.creditMessages !== pack.messages) {
    throw new BillingValidationError("Credit pack does not match the checkout order.");
  }

  if (checkout.status === "PAID") {
    return db.subscription.findUniqueOrThrow({
      where: { organizationId: input.organizationId },
    });
  }

  const subscription = await applyCreditPackToOrganization(
    input.organizationId,
    packId,
    db,
  );

  await db.billingCheckout.update({
    where: { razorpayOrderId: input.orderId },
    data: {
      status: "PAID",
      razorpayPaymentId: input.paymentId,
    },
  });

  return subscription;
}

export type CreateAdminPaymentLinkInput = {
  organizationId: string;
  plan: SubscriptionPlan;
  amountPaise?: number;
  contactLimit?: number;
  /** CUSTOM plans only; monthlyMessageLimit is derived as their sum. */
  smsMonthlyLimit?: number;
  whatsappMonthlyLimit?: number;
  emailMonthlyLimit?: number;
  durationDays?: number;
  customerEmail?: string;
  customerName?: string;
  /** Required when the org already has an active, unexpired non-FREE plan. */
  confirmRenewal?: boolean;
  db?: PrismaClient;
};

/**
 * Platform Admin creates a Razorpay Payment Link. Plan/limits apply only after payment.
 */
export async function createAdminPaymentLink(
  input: CreateAdminPaymentLinkInput,
) {
  const db = input.db ?? defaultPrisma;
  const organization = await db.organization.findUnique({
    where: { id: input.organizationId },
    select: {
      id: true,
      name: true,
      subscription: {
        select: { plan: true, status: true, paidUntil: true },
      },
    },
  });
  if (!organization) {
    throw new BillingValidationError("Organization not found");
  }

  const existing = organization.subscription;
  const hasActiveUnexpiredPlan =
    existing != null &&
    existing.plan !== SubscriptionPlan.FREE &&
    existing.status === SubscriptionStatus.ACTIVE &&
    existing.paidUntil != null &&
    existing.paidUntil > new Date();

  if (hasActiveUnexpiredPlan && input.confirmRenewal !== true) {
    throw new ActivePlanRenewalConfirmationRequiredError(
      `This organization already has an active ${existing!.plan} plan until ${existing!.paidUntil!.toISOString()}. Pass confirmRenewal=true to acknowledge creating a new payment link for it.`,
    );
  }

  const catalogue = await getPlanCatalogueEntry(input.plan, db);
  const durationDays = input.durationDays ?? DEFAULT_PAID_PERIOD_DAYS;

  let amountPaise = input.amountPaise ?? catalogue.amountPaise;
  let contactLimit = input.contactLimit ?? catalogue.contactLimit;
  let monthlyMessageLimit = catalogue.monthlyMessageLimit;
  let smsMonthlyLimit: number | undefined;
  let whatsappMonthlyLimit: number | undefined;
  let emailMonthlyLimit: number | undefined;

  if (input.plan === SubscriptionPlan.CUSTOM) {
    if (
      input.amountPaise == null ||
      input.contactLimit == null ||
      input.smsMonthlyLimit == null ||
      input.whatsappMonthlyLimit == null ||
      input.emailMonthlyLimit == null
    ) {
      throw new BillingValidationError(
        "CUSTOM deals require amountPaise, contactLimit, and per-channel message limits",
      );
    }
    amountPaise = input.amountPaise;
    contactLimit = input.contactLimit;
    smsMonthlyLimit = input.smsMonthlyLimit;
    whatsappMonthlyLimit = input.whatsappMonthlyLimit;
    emailMonthlyLimit = input.emailMonthlyLimit;
    monthlyMessageLimit =
      smsMonthlyLimit + whatsappMonthlyLimit + emailMonthlyLimit;
  }

  if (amountPaise == null || amountPaise < 100) {
    throw new BillingValidationError("Invalid payment amount");
  }

  if (input.plan === SubscriptionPlan.FREE) {
    throw new BillingValidationError("Cannot create a payment link for FREE");
  }

  const credentials = requireRazorpayCredentials();

  // Never leave more than one outstanding (CREATED) payment link payable for
  // the same org, regardless of plan: cancel any still-outstanding ones first.
  const outstanding = await db.billingCheckout.findMany({
    where: {
      organizationId: input.organizationId,
      kind: "PAYMENT_LINK",
      status: "CREATED",
    },
  });

  const supersededCheckoutIds: string[] = [];
  for (const old of outstanding) {
    if (!old.razorpayPaymentLinkId) {
      continue;
    }
    try {
      await cancelRazorpayPaymentLink(old.razorpayPaymentLinkId, credentials);
    } catch {
      throw new BillingValidationError(
        "An existing outstanding payment link could not be cancelled — it may already be paid. Check payment link history before retrying.",
      );
    }
    await db.billingCheckout.update({
      where: { id: old.id },
      data: { status: "CANCELLED" },
    });
    supersededCheckoutIds.push(old.id);
  }

  const appUrl =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.PLATFORM_APP_URL?.trim() ||
    "";

  const paymentLink = await createRazorpayPaymentLink(
    {
      amountPaise,
      currency: "INR",
      description: `${catalogue.label} plan for ${organization.name} (${durationDays} days)`,
      customer: {
        email: input.customerEmail,
        name: input.customerName ?? organization.name,
      },
      notes: {
        organizationId: input.organizationId,
        kind: "PAYMENT_LINK",
        plan: input.plan,
        contactLimit: String(contactLimit),
        monthlyMessageLimit: String(monthlyMessageLimit),
        ...(smsMonthlyLimit != null
          ? { smsMonthlyLimit: String(smsMonthlyLimit) }
          : {}),
        ...(whatsappMonthlyLimit != null
          ? { whatsappMonthlyLimit: String(whatsappMonthlyLimit) }
          : {}),
        ...(emailMonthlyLimit != null
          ? { emailMonthlyLimit: String(emailMonthlyLimit) }
          : {}),
        durationDays: String(durationDays),
      },
      callbackUrl: appUrl
        ? `${appUrl.replace(/\/$/, "")}/dashboard/settings/billing`
        : undefined,
    },
    credentials,
  );

  await db.billingCheckout.create({
    data: {
      organizationId: input.organizationId,
      kind: "PAYMENT_LINK",
      plan: input.plan,
      dealContactLimit: contactLimit,
      dealMonthlyMessageLimit: monthlyMessageLimit,
      dealSmsLimit: smsMonthlyLimit,
      dealWhatsappLimit: whatsappMonthlyLimit,
      dealEmailLimit: emailMonthlyLimit,
      durationDays,
      razorpayOrderId: `plink_${paymentLink.id}`,
      razorpayPaymentLinkId: paymentLink.id,
      amountPaise,
      currency: "INR",
      status: "CREATED",
    },
  });

  return {
    paymentLinkId: paymentLink.id,
    shortUrl: paymentLink.short_url,
    amountPaise,
    currency: "INR" as const,
    plan: input.plan,
    contactLimit,
    monthlyMessageLimit,
    smsMonthlyLimit,
    whatsappMonthlyLimit,
    emailMonthlyLimit,
    durationDays,
    supersededCheckoutIds,
  };
}

export type AdminPaymentLinkSummary = {
  id: string;
  plan: SubscriptionPlan | null;
  amountPaise: number;
  status: string;
  durationDays: number | null;
  dealContactLimit: number | null;
  dealSmsLimit: number | null;
  dealWhatsappLimit: number | null;
  dealEmailLimit: number | null;
  razorpayPaymentLinkId: string | null;
  createdAt: string;
};

/** Payment-link history for an org (any plan) — admin visibility only. */
export async function listAdminPaymentLinksForOrganization(
  organizationId: string,
  db: PrismaClient = defaultPrisma,
): Promise<AdminPaymentLinkSummary[]> {
  const checkouts = await db.billingCheckout.findMany({
    where: { organizationId, kind: "PAYMENT_LINK" },
    orderBy: { createdAt: "desc" },
  });

  return checkouts.map((checkout) => ({
    id: checkout.id,
    plan: checkout.plan,
    amountPaise: checkout.amountPaise,
    status: checkout.status,
    durationDays: checkout.durationDays,
    dealContactLimit: checkout.dealContactLimit,
    dealSmsLimit: checkout.dealSmsLimit,
    dealWhatsappLimit: checkout.dealWhatsappLimit,
    dealEmailLimit: checkout.dealEmailLimit,
    razorpayPaymentLinkId: checkout.razorpayPaymentLinkId,
    createdAt: checkout.createdAt.toISOString(),
  }));
}

/** Cancels a single outstanding (CREATED) payment link. Works for any plan. */
export async function cancelAdminPaymentLink(
  organizationId: string,
  checkoutId: string,
  db: PrismaClient = defaultPrisma,
) {
  const checkout = await db.billingCheckout.findUnique({
    where: { id: checkoutId },
  });

  if (!checkout || checkout.organizationId !== organizationId) {
    throw new BillingValidationError(
      "Payment link not found for this organization",
    );
  }
  if (checkout.kind !== "PAYMENT_LINK") {
    throw new BillingValidationError("Not a payment link checkout");
  }
  if (checkout.status !== "CREATED") {
    throw new BillingValidationError(
      `Cannot cancel a payment link with status ${checkout.status}`,
    );
  }
  if (!checkout.razorpayPaymentLinkId) {
    throw new BillingValidationError("Payment link has no Razorpay id");
  }

  const credentials = requireRazorpayCredentials();
  await cancelRazorpayPaymentLink(checkout.razorpayPaymentLinkId, credentials);

  return db.billingCheckout.update({
    where: { id: checkoutId },
    data: { status: "CANCELLED" },
  });
}
