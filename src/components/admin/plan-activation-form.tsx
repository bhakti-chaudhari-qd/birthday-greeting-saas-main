"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, secondaryButtonClass } from "@/components/ui/page";
import {
  formatInrFromPaise,
  getPlanDisplayLabel,
  type PlanLabelMap,
} from "@/lib/billing/catalogue";
import type { PlatformOrganizationDetail } from "@/lib/admin/org-ops";
import { getAdminClientDetailDict } from "@/lib/i18n/dictionaries/admin-client-detail";
import { useLocale } from "@/lib/i18n/use-locale";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

const DEAL_PLANS = ["STARTER", "PRO", "CUSTOM"] as const;

type PlanActivationFormProps = {
  organization: PlatformOrganizationDetail;
  planLabels: PlanLabelMap;
};

/** Razorpay payment links and direct (no-payment) plan activation for STARTER/PRO/CUSTOM. */
export function PlanActivationForm({
  organization,
  planLabels,
}: PlanActivationFormProps) {
  const router = useRouter();
  const dict = getAdminClientDetailDict(useLocale()).planActivation;
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [dealPlan, setDealPlan] =
    useState<(typeof DEAL_PLANS)[number]>("STARTER");
  const [amountRupees, setAmountRupees] = useState("499");
  const [contactLimit, setContactLimit] = useState(
    String(organization.contactLimit ?? 1000),
  );
  const findChannelLimit = (channel: "SMS" | "WHATSAPP" | "EMAIL") =>
    organization.channelLimits.find((entry) => entry.channel === channel)
      ?.monthlyLimit;
  const [smsMonthlyLimit, setSmsMonthlyLimit] = useState(
    String(findChannelLimit("SMS") ?? 0),
  );
  const [whatsappMonthlyLimit, setWhatsappMonthlyLimit] = useState(
    String(findChannelLimit("WHATSAPP") ?? 0),
  );
  const [emailMonthlyLimit, setEmailMonthlyLimit] = useState(
    String(findChannelLimit("EMAIL") ?? 0),
  );
  const [durationDays, setDurationDays] = useState("30");
  const [customerEmail, setCustomerEmail] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [activateBusy, setActivateBusy] = useState(false);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  /** Active, unexpired non-FREE plan on this org right now, if any. */
  function getActiveUnexpiredPlan(): { plan: string; paidUntil: Date } | null {
    if (
      !organization.plan ||
      organization.plan === "FREE" ||
      organization.subscriptionStatus !== "ACTIVE" ||
      !organization.paidUntil
    ) {
      return null;
    }
    const paidUntil = new Date(organization.paidUntil);
    return paidUntil > new Date() ? { plan: organization.plan, paidUntil } : null;
  }

  function computePaymentLinkWarning(): string | null {
    const active = getActiveUnexpiredPlan();
    if (!active) {
      return null;
    }
    const changingPlan = active.plan !== dealPlan;
    const activeLabel = getPlanDisplayLabel(active.plan, planLabels);
    const dealLabel = getPlanDisplayLabel(dealPlan, planLabels);
    return dict.paymentLinkWarning(
      activeLabel,
      formatCustomerDateTime(active.paidUntil),
      changingPlan,
      dealLabel,
    );
  }

  function handleCreatePaymentLinkClick() {
    const warning = computePaymentLinkWarning();
    if (warning) {
      setPendingConfirm({
        message: warning,
        onConfirm: () => {
          setPendingConfirm(null);
          void performCreatePaymentLink(true);
        },
      });
      return;
    }
    void performCreatePaymentLink(false);
  }

  async function performCreatePaymentLink(confirmRenewal: boolean) {
    setLinkBusy(true);
    setError(null);
    setSuccess(null);
    setPaymentLinkUrl(null);

    try {
      const amountPaise = Math.round(Number.parseFloat(amountRupees) * 100);
      const body: Record<string, unknown> = {
        plan: dealPlan,
        durationDays: Number.parseInt(durationDays, 10),
        ...(confirmRenewal ? { confirmRenewal: true } : {}),
      };
      if (customerEmail.trim()) {
        body.customerEmail = customerEmail.trim();
      }
      if (dealPlan === "CUSTOM") {
        body.amountPaise = amountPaise;
        body.contactLimit = Number.parseInt(contactLimit, 10);
        body.smsMonthlyLimit = Number.parseInt(smsMonthlyLimit, 10);
        body.whatsappMonthlyLimit = Number.parseInt(whatsappMonthlyLimit, 10);
        body.emailMonthlyLimit = Number.parseInt(emailMonthlyLimit, 10);
      } else if (Number.isFinite(amountPaise) && amountPaise >= 100) {
        body.amountPaise = amountPaise;
      }

      const response = await fetch(
        `/api/v1/admin/organizations/${organization.id}/payment-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? dict.failedToCreateLink);
        return;
      }
      setPaymentLinkUrl(payload.data.shortUrl);
      setSuccess(
        dict.linkCreatedSuccess(
          getPlanDisplayLabel(payload.data.plan, planLabels),
        ),
      );
      router.refresh();
    } catch {
      setError(dict.failedToCreateLink);
    } finally {
      setLinkBusy(false);
    }
  }

  function computeRenewalWarning(): string | null {
    const active = getActiveUnexpiredPlan();
    if (!active) {
      return null;
    }

    const durationDaysNum = Number.parseInt(durationDays, 10);
    const now = new Date();
    const base = active.paidUntil > now ? active.paidUntil : now;
    const newPaidUntil = new Date(
      base.getTime() + durationDaysNum * 24 * 60 * 60 * 1000,
    );
    const amountPaise = Math.round(Number.parseFloat(amountRupees) * 100);
    const amountLabel = Number.isFinite(amountPaise) && amountPaise > 0
      ? formatInrFromPaise(amountPaise)
      : dict.itsCatalougePrice;
    const changingPlan = active.plan !== dealPlan;
    const activeLabel = getPlanDisplayLabel(active.plan, planLabels);
    const dealLabel = getPlanDisplayLabel(dealPlan, planLabels);

    return dict.renewalWarning(
      activeLabel,
      formatCustomerDateTime(active.paidUntil),
      changingPlan,
      dealLabel,
      formatCustomerDateTime(newPaidUntil),
      amountLabel,
    );
  }

  function handleActivateWithoutPaymentClick() {
    const warning = computeRenewalWarning();
    if (warning) {
      setPendingConfirm({
        message: warning,
        onConfirm: () => {
          setPendingConfirm(null);
          void performActivateWithoutPayment(true);
        },
      });
      return;
    }
    void performActivateWithoutPayment(false);
  }

  async function performActivateWithoutPayment(confirmRenewal: boolean) {
    setError(null);
    setSuccess(null);
    setPaymentLinkUrl(null);
    setActivateBusy(true);

    try {
      const amountPaise = Math.round(Number.parseFloat(amountRupees) * 100);
      const body: Record<string, unknown> = {
        plan: dealPlan,
        durationDays: Number.parseInt(durationDays, 10),
        ...(confirmRenewal ? { confirmRenewal: true } : {}),
      };
      if (dealPlan === "CUSTOM") {
        body.amountPaise = amountPaise;
        body.contactLimit = Number.parseInt(contactLimit, 10);
        body.smsMonthlyLimit = Number.parseInt(smsMonthlyLimit, 10);
        body.whatsappMonthlyLimit = Number.parseInt(whatsappMonthlyLimit, 10);
        body.emailMonthlyLimit = Number.parseInt(emailMonthlyLimit, 10);
      } else if (Number.isFinite(amountPaise) && amountPaise >= 100) {
        body.amountPaise = amountPaise;
      }

      const response = await fetch(
        `/api/v1/admin/organizations/${organization.id}/plan-activations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? dict.failedToActivate);
        return;
      }
      setSuccess(dict.activatedSuccess(getPlanDisplayLabel(dealPlan, planLabels)));
      router.refresh();
    } catch {
      setError(dict.failedToActivate);
    } finally {
      setActivateBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
        <p>
          {dict.currentPlan}:{" "}
          <strong>{getPlanDisplayLabel(organization.plan, planLabels)}</strong>{" "}
          · {organization.subscriptionStatus ?? "n/a"}
        </p>
        <p className="mt-1">
          {dict.limits}: {(organization.contactLimit ?? 0).toLocaleString("en-IN")}{" "}
          {dict.contactsWord} ·{" "}
          {(organization.monthlyMessageLimit ?? 0).toLocaleString("en-IN")}{" "}
          {dict.messagesPerMonth} · {dict.sent}{" "}
          {(organization.messagesSentThisMonth ?? 0).toLocaleString("en-IN")}
        </p>
        <p className="mt-1">
          {dict.accessUntil}:{" "}
          <strong>
            {organization.paidUntil
              ? formatCustomerDateTime(organization.paidUntil)
              : dict.notSet}
          </strong>
        </p>
      </div>

      <p className="text-sm text-stone-600">{dict.description}</p>

      <label className="block text-sm">
        <span className="font-medium text-stone-800">{dict.plan}</span>
        <select
          className={`mt-1 ${inputClass}`}
          value={dealPlan}
          onChange={(event) =>
            setDealPlan(event.target.value as (typeof DEAL_PLANS)[number])
          }
        >
          {DEAL_PLANS.map((value) => (
            <option key={value} value={value}>
              {getPlanDisplayLabel(value, planLabels)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-stone-800">
            {dict.amountInr}
            {dealPlan === "CUSTOM" ? "" : dict.optionalOverride}
          </span>
          <input
            className={`mt-1 ${inputClass}`}
            type="number"
            min={1}
            step="1"
            value={amountRupees}
            onChange={(event) => setAmountRupees(event.target.value)}
            required={dealPlan === "CUSTOM"}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">{dict.durationDays}</span>
          <input
            className={`mt-1 ${inputClass}`}
            type="number"
            min={1}
            max={366}
            value={durationDays}
            onChange={(event) => setDurationDays(event.target.value)}
            required
          />
        </label>
      </div>

      {dealPlan === "CUSTOM" ? (
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.contactLimit}</span>
            <input
              className={`mt-1 ${inputClass}`}
              type="number"
              min={1}
              value={contactLimit}
              onChange={(event) => setContactLimit(event.target.value)}
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="font-medium text-stone-800">
                {dict.smsMessagesPerMonth}
              </span>
              <input
                className={`mt-1 ${inputClass}`}
                type="number"
                min={0}
                value={smsMonthlyLimit}
                onChange={(event) => setSmsMonthlyLimit(event.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-stone-800">
                {dict.whatsappMessagesPerMonth}
              </span>
              <input
                className={`mt-1 ${inputClass}`}
                type="number"
                min={0}
                value={whatsappMonthlyLimit}
                onChange={(event) =>
                  setWhatsappMonthlyLimit(event.target.value)
                }
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-stone-800">
                {dict.emailMessagesPerMonth}
              </span>
              <input
                className={`mt-1 ${inputClass}`}
                type="number"
                min={0}
                value={emailMonthlyLimit}
                onChange={(event) => setEmailMonthlyLimit(event.target.value)}
                required
              />
            </label>
          </div>
          <p className="text-sm text-stone-600">
            {dict.totalMonthlyMessages}:{" "}
            <strong>
              {(
                (Number.parseInt(smsMonthlyLimit, 10) || 0) +
                (Number.parseInt(whatsappMonthlyLimit, 10) || 0) +
                (Number.parseInt(emailMonthlyLimit, 10) || 0)
              ).toLocaleString("en-IN")}
            </strong>{" "}
            {dict.totalMonthlyMessagesHint}
          </p>
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="font-medium text-stone-800">{dict.customerEmail}</span>
        <input
          className={`mt-1 ${inputClass}`}
          type="email"
          value={customerEmail}
          onChange={(event) => setCustomerEmail(event.target.value)}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={linkBusy}
          className={secondaryButtonClass}
          onClick={handleCreatePaymentLinkClick}
        >
          {linkBusy ? dict.creatingLink : dict.createPaymentLink}
        </button>

        <button
          type="button"
          disabled={activateBusy}
          className={secondaryButtonClass}
          onClick={handleActivateWithoutPaymentClick}
        >
          {activateBusy ? dict.activating : dict.activateWithoutPayment}
        </button>
      </div>

      <p className="text-xs text-stone-500">
        {dict.activateWithoutPaymentNote(Number(durationDays))}
      </p>

      {paymentLinkUrl ? (
        <p className="break-all text-sm text-sky-900">
          {dict.link}:{" "}
          <a
            href={paymentLinkUrl}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {paymentLinkUrl}
          </a>
          {Number.isFinite(Number.parseFloat(amountRupees)) ? (
            <span className="mt-1 block text-stone-600">
              {dict.amountPreview}:{" "}
              {formatInrFromPaise(
                Math.round(Number.parseFloat(amountRupees) * 100),
              )}
            </span>
          ) : null}
        </p>
      ) : null}

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}

      <ConfirmDialog
        open={pendingConfirm !== null}
        title={dict.confirmRenewalTitle}
        message={pendingConfirm?.message ?? null}
        confirmLabel={dict.continueAnyway}
        cancelLabel={dict.cancel}
        busy={activateBusy || linkBusy}
        onConfirm={() => pendingConfirm?.onConfirm()}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
}
