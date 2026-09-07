"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { StatusBadge } from "@/components/ui/feedback";
import { compactSecondaryButtonClass } from "@/components/ui/page";
import type { PlatformFailedQueueDiagnostic } from "@/lib/admin/failed-queue";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

type FailedQueueTableProps = {
  organizationId: string;
  items: PlatformFailedQueueDiagnostic[];
};

const AMBIGUOUS_FAILURE_PREFIX = "Provider acceptance is unknown.";

export function FailedQueueTable({
  organizationId,
  items,
}: FailedQueueTableProps) {
  const router = useRouter();
  const [pendingQueueId, setPendingQueueId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startRefreshTransition] = useTransition();

  async function retry(item: PlatformFailedQueueDiagnostic) {
    const requiresConfirmation = item.failureReason.startsWith(
      AMBIGUOUS_FAILURE_PREFIX,
    );

    if (
      requiresConfirmation &&
      !window.confirm(
        "This may send a second message if the first already went through. Retry anyway?",
      )
    ) {
      return;
    }

    setPendingQueueId(item.id);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/admin/organizations/${organizationId}/queue/${item.id}/retry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmAmbiguousRetry: requiresConfirmation || undefined,
          }),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error?.message ?? "Failed to schedule retry");
        return;
      }

      router.refresh();
    } catch {
      setError("Failed to schedule retry");
    } finally {
      setPendingQueueId(null);
    }
  }

  function refresh() {
    setError(null);
    startRefreshTransition(() => {
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex justify-end border-b border-stone-200 px-4 py-2">
        <button
          type="button"
          className={compactSecondaryButtonClass}
          disabled={isRefreshing || pendingQueueId !== null}
          onClick={refresh}
        >
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {error ? (
        <p className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
            <tr>
              <th className="px-4 py-2.5 font-medium">Queue</th>
              <th className="px-4 py-2.5 font-medium">Channel</th>
              <th className="px-4 py-2.5 font-medium">Failure</th>
              <th className="px-4 py-2.5 font-medium">Attempts</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-stone-500" colSpan={6}>
                  No failed queue items.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-stone-100">
                  <td className="px-4 py-3 font-mono text-stone-700">
                    {item.id}
                  </td>
                  <td className="px-4 py-3 text-stone-700">
                    <div>{item.channel}</div>
                    <StatusBadge label={item.status} tone="danger" />
                  </td>
                  <td className="max-w-sm px-4 py-3 text-stone-700">
                    {item.failureReason}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                    {item.attemptCount}
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3 text-stone-600"
                    title={`Created ${formatCustomerDateTime(item.createdAt)}`}
                  >
                    {formatCustomerDateTime(item.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={compactSecondaryButtonClass}
                      disabled={pendingQueueId !== null}
                      onClick={() => retry(item)}
                    >
                      {pendingQueueId === item.id ? "Scheduling…" : "Retry"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
