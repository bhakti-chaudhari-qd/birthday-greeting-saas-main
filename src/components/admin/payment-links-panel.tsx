"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert, StatusBadge } from "@/components/ui/feedback";
import { secondaryButtonClass } from "@/components/ui/page";
import {
  formatInrFromPaise,
  getPlanDisplayLabel,
  type PlanLabelMap,
} from "@/lib/billing/catalogue";
import type { AdminPaymentLinkSummary } from "@/lib/billing/service";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

type PaymentLinksPanelProps = {
  organizationId: string;
  paymentLinks: AdminPaymentLinkSummary[];
  planLabels: PlanLabelMap;
};

const STATUS_TONE = {
  CREATED: "info",
  PAID: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
} as const;

export function PaymentLinksPanel({
  organizationId,
  paymentLinks,
  planLabels,
}: PaymentLinksPanelProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);

  async function performCancel(checkoutId: string) {
    setBusyId(checkoutId);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/admin/organizations/${organizationId}/payment-link/${checkoutId}/cancel`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Failed to cancel payment link");
        return;
      }
      router.refresh();
    } catch {
      setError("Failed to cancel payment link");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 p-5 sm:p-6">
      {paymentLinks.length === 0 ? (
        <p className="text-sm text-stone-500">No payment links created yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Duration</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {paymentLinks.map((link) => (
                <tr key={link.id}>
                  <td className="py-2 pr-4 whitespace-nowrap text-stone-700">
                    {formatCustomerDateTime(link.createdAt)}
                  </td>
                  <td className="py-2 pr-4 text-stone-700">
                    {link.plan ? getPlanDisplayLabel(link.plan, planLabels) : "—"}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap text-stone-700">
                    {formatInrFromPaise(link.amountPaise)}
                  </td>
                  <td className="py-2 pr-4">
                    <StatusBadge
                      label={link.status}
                      tone={
                        STATUS_TONE[link.status as keyof typeof STATUS_TONE] ??
                        "neutral"
                      }
                    />
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap text-stone-700">
                    {link.durationDays != null ? `${link.durationDays}d` : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    {link.status === "CREATED" ? (
                      <button
                        type="button"
                        disabled={busyId === link.id}
                        className={secondaryButtonClass}
                        onClick={() => setPendingCancelId(link.id)}
                      >
                        {busyId === link.id ? "Cancelling…" : "Cancel"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <ConfirmDialog
        open={pendingCancelId !== null}
        title="Cancel payment link?"
        message="It will no longer be payable. This can't be undone from here."
        confirmLabel="Cancel link"
        cancelLabel="Keep it"
        busy={busyId !== null}
        onConfirm={() => {
          if (pendingCancelId) {
            void performCancel(pendingCancelId);
          }
          setPendingCancelId(null);
        }}
        onCancel={() => setPendingCancelId(null)}
      />
    </div>
  );
}
