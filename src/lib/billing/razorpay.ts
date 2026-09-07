import { createHmac, timingSafeEqual } from "node:crypto";

import { isBillingConfigured } from "@/lib/env";

export class BillingNotConfiguredError extends Error {
  constructor(message = "Billing is not configured") {
    super(message);
    this.name = "BillingNotConfiguredError";
  }
}

export class RazorpayApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RazorpayApiError";
    this.status = status;
  }
}

export type RazorpayCredentials = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
};

export function getRazorpayCredentials(
  raw: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): RazorpayCredentials | null {
  if (!isBillingConfigured(raw)) {
    return null;
  }

  const keyId = raw.RAZORPAY_KEY_ID?.trim();
  const keySecret = raw.RAZORPAY_KEY_SECRET?.trim();
  const webhookSecret = raw.RAZORPAY_WEBHOOK_SECRET?.trim();

  if (!keyId || !keySecret || !webhookSecret) {
    return null;
  }

  return { keyId, keySecret, webhookSecret };
}

export function requireRazorpayCredentials(
  raw: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): RazorpayCredentials {
  const credentials = getRazorpayCredentials(raw);
  if (!credentials) {
    throw new BillingNotConfiguredError(
      "Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET (and optionally BILLING_ENABLED=true) to enable checkout.",
    );
  }
  return credentials;
}

function basicAuthHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

export type CreateRazorpayOrderInput = {
  amountPaise: number;
  currency: "INR";
  receipt: string;
  notes: Record<string, string>;
};

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
};

export async function createRazorpayOrder(
  input: CreateRazorpayOrderInput,
  credentials: RazorpayCredentials = requireRazorpayCredentials(),
): Promise<RazorpayOrder> {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(credentials.keyId, credentials.keySecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | RazorpayOrder
    | { error?: { description?: string } }
    | null;

  if (!response.ok) {
    const description =
      body && "error" in body
        ? body.error?.description
        : undefined;
    throw new RazorpayApiError(
      description || `Razorpay order create failed (${response.status})`,
      response.status,
    );
  }

  return body as RazorpayOrder;
}

export type CreateRazorpayPlanInput = {
  name: string;
  amountPaise: number;
  currency: "INR";
  period?: "monthly";
  interval?: number;
};

export type RazorpayPlan = {
  id: string;
  period: string;
  interval: number;
};

export async function createRazorpayPlan(
  input: CreateRazorpayPlanInput,
  credentials: RazorpayCredentials = requireRazorpayCredentials(),
): Promise<RazorpayPlan> {
  const response = await fetch("https://api.razorpay.com/v1/plans", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(credentials.keyId, credentials.keySecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      period: input.period ?? "monthly",
      interval: input.interval ?? 1,
      item: {
        name: input.name,
        amount: input.amountPaise,
        currency: input.currency,
      },
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | RazorpayPlan
    | { error?: { description?: string } }
    | null;

  if (!response.ok) {
    const description =
      body && "error" in body ? body.error?.description : undefined;
    throw new RazorpayApiError(
      description || `Razorpay plan create failed (${response.status})`,
      response.status,
    );
  }

  return body as RazorpayPlan;
}

export type CreateRazorpaySubscriptionInput = {
  planId: string;
  totalCount?: number;
  notes: Record<string, string>;
};

export type RazorpaySubscription = {
  id: string;
  status: string;
  plan_id: string;
};

export async function createRazorpaySubscription(
  input: CreateRazorpaySubscriptionInput,
  credentials: RazorpayCredentials = requireRazorpayCredentials(),
): Promise<RazorpaySubscription> {
  const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(credentials.keyId, credentials.keySecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: input.planId,
      total_count: input.totalCount ?? 120,
      customer_notify: 1,
      notes: input.notes,
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | RazorpaySubscription
    | { error?: { description?: string } }
    | null;

  if (!response.ok) {
    const description =
      body && "error" in body ? body.error?.description : undefined;
    throw new RazorpayApiError(
      description || `Razorpay subscription create failed (${response.status})`,
      response.status,
    );
  }

  return body as RazorpaySubscription;
}

export type CreateRazorpayPaymentLinkInput = {
  amountPaise: number;
  currency: "INR";
  description: string;
  customer?: { name?: string; email?: string };
  notes: Record<string, string>;
  callbackUrl?: string;
};

export type RazorpayPaymentLink = {
  id: string;
  short_url: string;
  status: string;
  amount: number;
};

export async function createRazorpayPaymentLink(
  input: CreateRazorpayPaymentLinkInput,
  credentials: RazorpayCredentials = requireRazorpayCredentials(),
): Promise<RazorpayPaymentLink> {
  const response = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(credentials.keyId, credentials.keySecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency,
      description: input.description,
      customer: input.customer,
      notes: input.notes,
      callback_url: input.callbackUrl,
      callback_method: input.callbackUrl ? "get" : undefined,
      notify: { sms: false, email: true },
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | RazorpayPaymentLink
    | { error?: { description?: string } }
    | null;

  if (!response.ok) {
    const description =
      body && "error" in body ? body.error?.description : undefined;
    throw new RazorpayApiError(
      description || `Razorpay payment link create failed (${response.status})`,
      response.status,
    );
  }

  return body as RazorpayPaymentLink;
}

export async function cancelRazorpayPaymentLink(
  paymentLinkId: string,
  credentials: RazorpayCredentials = requireRazorpayCredentials(),
): Promise<RazorpayPaymentLink> {
  const response = await fetch(
    `https://api.razorpay.com/v1/payment_links/${paymentLinkId}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(credentials.keyId, credentials.keySecret),
      },
    },
  );

  const body = (await response.json().catch(() => null)) as
    | RazorpayPaymentLink
    | { error?: { description?: string } }
    | null;

  if (!response.ok) {
    const description =
      body && "error" in body ? body.error?.description : undefined;
    throw new RazorpayApiError(
      description || `Razorpay payment link cancel failed (${response.status})`,
      response.status,
    );
  }

  return body as RazorpayPaymentLink;
}

/** Subscription checkout signature: HMAC_SHA256(payment_id|subscription_id). */
export function verifyRazorpaySubscriptionPaymentSignature(input: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const expected = createHmac("sha256", input.keySecret)
    .update(`${input.paymentId}|${input.subscriptionId}`)
    .digest("hex");

  const provided = input.signature.trim();
  if (expected.length !== provided.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(provided, "utf8"),
    );
  } catch {
    return false;
  }
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const provided = signatureHeader.trim();
  if (expected.length !== provided.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(provided, "utf8"),
    );
  } catch {
    return false;
  }
}

/** Checkout success callback signature: HMAC_SHA256(orderId|paymentId, key_secret). */
export function verifyRazorpayPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const expected = createHmac("sha256", input.keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");

  const provided = input.signature.trim();
  if (expected.length !== provided.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(provided, "utf8"),
    );
  } catch {
    return false;
  }
}
