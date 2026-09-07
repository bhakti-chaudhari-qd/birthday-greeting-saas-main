"use client";

import { useCallback, useEffect, useState } from "react";

import { formatInrFromPaise } from "@/lib/billing/catalogue";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

type CatalogueEntry = {
  plan: "FREE" | "STARTER" | "PRO" | "CUSTOM";
  label: string;
  description: string;
  amountPaise: number | null;
  currency: "INR";
  contactLimit: number;
  monthlyMessageLimit: number;
  checkoutEnabled: boolean;
};

type CreditPackEntry = {
  id: "credits-5k" | "credits-25k";
  label: string;
  description: string;
  messages: number;
  amountPaise: number;
  currency: "INR";
  checkoutEnabled: boolean;
};

type BillingOverview = {
  billingReady: boolean;
  subscription: {
    plan: string;
    status: string;
    contactLimit: number;
    monthlyMessageLimit: number;
    bonusMessageCredits: number;
    effectiveMonthlyMessageLimit: number;
    messagesSentThisMonth: number;
    /** Per-channel allocation for CUSTOM plans; empty when using the aggregate limit. */
    channelBreakdown: Array<{
      channel: string;
      monthlyLimit: number;
      messagesSentThisMonth: number;
    }>;
    billingPeriodStart: string;
    billingPeriodEnd: string | null;
    paidUntil: string | null;
  };
  catalogue: CatalogueEntry[];
  creditPacks: CreditPackEntry[];
};

type PlanCheckoutOrder = {
  kind: "PLAN";
  mode?: "subscription" | "order";
  orderId: string;
  subscriptionId?: string;
  amount: number;
  currency: "INR";
  keyId: string;
  plan: "STARTER" | "PRO";
  label: string;
};

type CreditCheckoutOrder = {
  kind: "CREDITS";
  orderId: string;
  amount: number;
  currency: "INR";
  keyId: string;
  packId: "credits-5k" | "credits-25k";
  label: string;
  messages: number;
};

type CheckoutOrder = PlanCheckoutOrder | CreditCheckoutOrder;

type RazorpayOptions = {
  key: string;
  amount?: number;
  currency?: string;
  name: string;
  description: string;
  order_id?: string;
  subscription_id?: string;
  handler: (response: RazorpaySuccessResponse) => void;
  theme?: { color?: string };
};

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-razorpay-checkout="1"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Razorpay Checkout")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "1";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Razorpay Checkout"));
    document.body.appendChild(script);
  });
}

export function BillingSettingsClient() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/billing");
      const body = (await response.json()) as {
        data?: BillingOverview;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(body.error?.message || "Failed to load billing");
      }
      setOverview(body.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOverview(), 0);
    return () => window.clearTimeout(timer);
  }, [loadOverview]);

  async function openRazorpayCheckout(order: CheckoutOrder) {
    await loadRazorpayScript();

    if (!window.Razorpay) {
      throw new Error("Razorpay Checkout is unavailable");
    }

    const description =
      order.kind === "PLAN"
        ? `${order.label} plan`
        : `${order.label} (+${order.messages.toLocaleString("en-IN")})`;

    const useSubscription =
      order.kind === "PLAN" &&
      order.mode === "subscription" &&
      Boolean(order.subscriptionId);

    const checkout = new window.Razorpay({
      key: order.keyId,
      name: "Birthday Greeting",
      description,
      theme: { color: "#1e3a5f" },
      ...(useSubscription
        ? { subscription_id: order.subscriptionId }
        : {
            amount: order.amount,
            currency: order.currency,
            order_id: order.orderId,
          }),
      handler: (payment) => {
        void (async () => {
          try {
            const confirmBody =
              order.kind === "PLAN"
                ? {
                    plan: order.plan,
                    orderId: payment.razorpay_order_id ?? order.orderId,
                    subscriptionId:
                      payment.razorpay_subscription_id ?? order.subscriptionId,
                    paymentId: payment.razorpay_payment_id,
                    signature: payment.razorpay_signature,
                  }
                : {
                    packId: order.packId,
                    orderId: payment.razorpay_order_id ?? order.orderId,
                    paymentId: payment.razorpay_payment_id,
                    signature: payment.razorpay_signature,
                  };

            const confirmResponse = await fetch("/api/v1/billing/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(confirmBody),
            });
            const confirmPayload = (await confirmResponse.json()) as {
              error?: { message?: string };
            };
            if (!confirmResponse.ok) {
              throw new Error(
                confirmPayload.error?.message ||
                  "Payment received but confirmation failed. Refresh shortly.",
              );
            }
            setSuccess(
              order.kind === "PLAN"
                ? `${order.label} is now active. Limits will apply immediately.`
                : `${order.label} added for this month.`,
            );
            await loadOverview();
          } catch (confirmError) {
            setError(
              confirmError instanceof Error
                ? confirmError.message
                : "Payment confirmation failed",
            );
          } finally {
            setBusyKey(null);
          }
        })();
      },
    });

    checkout.open();
  }

  async function startPlanCheckout(plan: "STARTER" | "PRO") {
    setBusyKey(plan);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = (await response.json()) as {
        data?: CheckoutOrder;
        error?: { message?: string };
      };

      if (!response.ok || !body.data || body.data.kind !== "PLAN") {
        throw new Error(body.error?.message || "Failed to start checkout");
      }

      await openRazorpayCheckout(body.data);
      setBusyKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusyKey(null);
    }
  }

  async function startCreditCheckout(packId: CreditPackEntry["id"]) {
    setBusyKey(packId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const body = (await response.json()) as {
        data?: CheckoutOrder;
        error?: { message?: string };
      };

      if (!response.ok || !body.data || body.data.kind !== "CREDITS") {
        throw new Error(body.error?.message || "Failed to start checkout");
      }

      await openRazorpayCheckout(body.data);
      setBusyKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusyKey(null);
    }
  }

  if (loading && !overview) {
    return <p className="text-sm text-stone-600">Loading billing…</p>;
  }

  if (!overview) {
    return (
      <p className="text-sm text-red-700">{error || "Billing unavailable."}</p>
    );
  }

  const { subscription } = overview;
  const creditPacks = overview.creditPacks ?? [];
  const currentPlanLabel =
    overview.catalogue.find((entry) => entry.plan === subscription.plan)?.label ??
    subscription.plan;

  return (
    <div className="flex flex-col gap-6">
      {!overview.billingReady ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Razorpay isn&apos;t configured. Upgrades and credit packs stay disabled
          until billing keys are set.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {success}
        </div>
      ) : null}

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Current plan
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-stone-500">Plan</dt>
            <dd className="text-lg font-semibold text-stone-900">
              {currentPlanLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Status</dt>
            <dd className="text-lg font-semibold text-stone-900">
              {subscription.status}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Contacts limit</dt>
            <dd className="text-sm text-stone-800">
              {subscription.contactLimit.toLocaleString("en-IN")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Messages this month</dt>
            <dd className="text-sm text-stone-800">
              {subscription.messagesSentThisMonth.toLocaleString("en-IN")} /{" "}
              {subscription.effectiveMonthlyMessageLimit.toLocaleString("en-IN")}
              {subscription.bonusMessageCredits > 0 ? (
                <span className="mt-0.5 block text-xs font-normal text-stone-500">
                  Includes{" "}
                  {subscription.bonusMessageCredits.toLocaleString("en-IN")}{" "}
                  bonus credits
                </span>
              ) : null}
              {subscription.plan === "CUSTOM" &&
              subscription.channelBreakdown.length > 0 ? (
                <span className="mt-1 block space-y-0.5 text-xs font-normal text-stone-500">
                  {subscription.channelBreakdown.map((entry) => (
                    <span key={entry.channel} className="block">
                      {entry.channel}:{" "}
                      {entry.messagesSentThisMonth.toLocaleString("en-IN")} /{" "}
                      {entry.monthlyLimit.toLocaleString("en-IN")}
                    </span>
                  ))}
                </span>
              ) : null}
            </dd>
          </div>
          {subscription.paidUntil ? (
            <div>
              <dt className="text-xs text-stone-500">Paid until</dt>
              <dd className="text-sm text-stone-800">
                {formatCustomerDateTime(subscription.paidUntil)}
              </dd>
            </div>
          ) : null}
        </dl>
        {subscription.status !== "ACTIVE" ? (
          <p className="mt-4 text-sm text-amber-800">
            Sending is blocked while {subscription.status.toLowerCase()}.
            Upgrade or contact Platform Admin.
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Plans
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {overview.catalogue
            .filter((entry) => entry.plan === "STARTER" || entry.plan === "PRO")
            .map((entry) => {
              const isCurrent = subscription.plan === entry.plan;
              const busy = busyKey === entry.plan;
              return (
                <article
                  key={entry.plan}
                  className="flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="text-lg font-semibold text-stone-900">
                    {entry.label}
                  </h3>
                  <p className="mt-1 text-sm text-stone-600">
                    {entry.description}
                  </p>
                  <p className="mt-4 text-2xl font-semibold text-stone-900">
                    {entry.amountPaise != null
                      ? formatInrFromPaise(entry.amountPaise)
                      : "-"}
                    <span className="ml-1 text-sm font-normal text-stone-500">
                      / month
                    </span>
                  </p>
                  <ul className="mt-3 flex-1 space-y-1 text-sm text-stone-700">
                    <li>
                      {entry.contactLimit.toLocaleString("en-IN")} contacts
                    </li>
                    <li>
                      {entry.monthlyMessageLimit.toLocaleString("en-IN")}{" "}
                      messages / month
                    </li>
                  </ul>
                  <button
                    type="button"
                    disabled={
                      !entry.checkoutEnabled ||
                      isCurrent ||
                      Boolean(busyKey)
                    }
                    onClick={() =>
                      void startPlanCheckout(entry.plan as "STARTER" | "PRO")
                    }
                    className="mt-5 rounded-lg bg-sky-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-300"
                  >
                    {isCurrent
                      ? "Current plan"
                      : busy
                        ? "Opening checkout…"
                        : `Upgrade to ${entry.label}`}
                  </button>
                </article>
              );
            })}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Extra messages
        </h2>
        <p className="mb-3 text-sm text-stone-600">
          Buy a pack if you hit this month&apos;s send limit. Credits apply
          immediately and reset at the start of the next month (IST). Payment
          methods (including UPI QR) appear in the Razorpay checkout popup.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {creditPacks.map((pack) => {
            const busy = busyKey === pack.id;
            return (
              <article
                key={pack.id}
                className="flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-stone-900">
                  {pack.label}
                </h3>
                <p className="mt-1 text-sm text-stone-600">{pack.description}</p>
                <p className="mt-4 text-2xl font-semibold text-stone-900">
                  {formatInrFromPaise(pack.amountPaise)}
                </p>
                <p className="mt-2 text-sm text-stone-700">
                  +{pack.messages.toLocaleString("en-IN")} messages this month
                </p>
                <button
                  type="button"
                  disabled={!pack.checkoutEnabled || Boolean(busyKey)}
                  onClick={() => void startCreditCheckout(pack.id)}
                  className="mt-5 rounded-lg bg-sky-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  {busy
                    ? "Opening checkout…"
                    : pack.checkoutEnabled
                      ? "Buy pack"
                      : "Requires ACTIVE paid plan"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-stone-500">
        Plans and credit packs activate after Razorpay verifies payment. Prices
        come from the server.
      </p>
    </div>
  );
}
