"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import {
  EmptyState,
  InlineAlert,
  StatusBadge,
  deliveryStatusTone,
} from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  SecondaryButtonLink,
  compactSecondaryButtonClass,
  inputClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import { StatusFilterChips } from "@/components/ui/status-filter-chips";
import {
  DELIVERY_MORE_STATUS_FILTERS,
  DELIVERY_REPORT_FILTERS,
  getCustomerDeliveryStatusHint,
  getCustomerDeliveryStatusLabel,
  getCustomerSmsProviderLabel,
  getCustomerWhatsAppProviderLabel,
} from "@/lib/ui/customer-labels";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

type DeliveryItem = {
  id: string;
  sendQueueId: string;
  contactName: string;
  contactMobile: string;
  templateName: string;
  channel: string;
  provider: string | null;
  providerMessageId: string | null;
  status: string;
  attemptNumber: number;
  errorMessage: string | null;
  renderedPreview: string;
  mediaFilename: string | null;
  mediaSimulated: boolean;
  createdAt: string;
};

type DeliveriesResponse = {
  data: DeliveryItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type RefreshFeedback = {
  deliveryLogId: string;
  tone: "success" | "info" | "error";
  message: string;
};

const PRIMARY_STATUS_VALUES: Set<string> = new Set(
  DELIVERY_REPORT_FILTERS.map((item) => item.value).filter(Boolean),
);

function canRefreshDelivery(item: DeliveryItem): boolean {
  return item.status === "SENT" && Boolean(item.providerMessageId?.trim());
}

function providerLabel(channel: string, provider: string | null): string {
  if (channel === "WHATSAPP") {
    return getCustomerWhatsAppProviderLabel(provider);
  }
  return getCustomerSmsProviderLabel(provider);
}

export type DeliveriesPageClientProps = {
  /** Organization Owners can export; Staff cannot (API is ADMIN-only). */
  canExport: boolean;
};

function DeliveriesPageContent({ canExport }: DeliveriesPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "";

  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [meta, setMeta] = useState<DeliveriesResponse["meta"] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [channel, setChannel] = useState("");
  const [provider, setProvider] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshFeedback, setRefreshFeedback] = useState<RefreshFeedback | null>(
    null,
  );
  const [refreshToken, setRefreshToken] = useState(0);

  const reloadDeliveries = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  const applyStatus = useCallback(
    (next: string) => {
      setPage(1);
      setStatus(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next) {
        params.set("status", next);
      } else {
        params.delete("status");
      }
      const query = params.toString();
      router.replace(query ? `?${query}` : "/dashboard/deliveries");
    },
    [router, searchParams],
  );

  useEffect(() => {
    async function loadDeliveries() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
      });

      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (channel) params.set("channel", channel);
      if (provider) params.set("provider", provider);

      try {
        const response = await fetch(`/api/v1/deliveries?${params.toString()}`);
        const body = await response.json();

        if (!response.ok) {
          setError(body.error?.message ?? "Could not load delivery results.");
          return;
        }

        setItems(body.data);
        setMeta(body.meta);
      } catch {
        setError("Could not load delivery results. Try again.");
      } finally {
        setLoading(false);
      }
    }

    void loadDeliveries();
  }, [page, search, status, channel, provider, refreshToken]);

  async function handleExport() {
    setExporting(true);
    setError(null);

    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    if (channel) params.set("channel", channel);
    if (provider) params.set("provider", provider);

    try {
      const query = params.toString();
      const response = await fetch(
        `/api/v1/deliveries/export${query ? `?${query}` : ""}`,
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(
          body?.error?.message ?? "Could not export submitted history. Try again.",
        );
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "sent-history.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(
        "Could not export submitted history. Check your connection and try again.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleRefresh(deliveryLogId: string) {
    setRefreshingId(deliveryLogId);
    setRefreshFeedback(null);
    setError(null);

    try {
      const response = await fetch(`/api/v1/deliveries/${deliveryLogId}/refresh`, {
        method: "POST",
      });
      const body = await response.json();

      if (!response.ok) {
        setRefreshFeedback({
          deliveryLogId,
          tone: "error",
          message: body.error?.message ?? "Failed to refresh delivery status",
        });
        return;
      }

      const result = body.data;
      const tone =
        result.result === "refreshed"
          ? "success"
          : result.result === "already_terminal"
            ? "info"
            : "info";

      setRefreshFeedback({
        deliveryLogId,
        tone,
        message:
          result.message ??
          (result.result === "refreshed"
            ? "Delivery status refreshed"
            : "Delivery status checked"),
      });
      reloadDeliveries();
    } catch {
      setRefreshFeedback({
        deliveryLogId,
        tone: "error",
        message: "Failed to refresh delivery status",
      });
    } finally {
      setRefreshingId(null);
    }
  }

  const moreStatusValue =
    status && !PRIMARY_STATUS_VALUES.has(status) ? status : "";
  const hasFilters = Boolean(search.trim() || status || channel || provider);

  return (
    <PageShell wide>
      <PageHeader
        title="Submitted"
        actions={
          <>
            {canExport ? (
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={exporting || loading}
                className={secondaryButtonClass}
              >
                {exporting ? "Exporting…" : "Export report"}
              </button>
            ) : null}
            <SecondaryButtonLink href="/dashboard/queue?status=PENDING">
              View Scheduled
            </SecondaryButtonLink>
          </>
        }
      />

      {items.some((item) => item.provider === "TEST") ? (
        <InlineAlert tone="info">
          Test messages are simulated. Nothing was actually sent.
        </InlineAlert>
      ) : null}

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {refreshFeedback ? (
        <InlineAlert
          tone={
            refreshFeedback.tone === "error"
              ? "error"
              : refreshFeedback.tone === "success"
                ? "success"
                : "info"
          }
        >
          {refreshFeedback.message}
        </InlineAlert>
      ) : null}

      <Panel className="space-y-4 p-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
            Status
          </p>
          <StatusFilterChips
            options={DELIVERY_REPORT_FILTERS}
            value={
              status === "" || PRIMARY_STATUS_VALUES.has(status)
                ? status
                : "__other__"
            }
            onChange={applyStatus}
            ariaLabel="Delivery status report filters"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="sr-only">Search contact</span>
            <input
              className={inputClass}
              placeholder="Search contact"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
            />
          </label>
          <label className="block text-sm">
            <span className="sr-only">More statuses</span>
            <select
              className={inputClass}
              value={moreStatusValue}
              onChange={(event) => applyStatus(event.target.value)}
            >
              <option value="">More statuses…</option>
              {DELIVERY_MORE_STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="sr-only">Channel filter</span>
            <select
              className={inputClass}
              value={channel}
              onChange={(event) => {
                setPage(1);
                setChannel(event.target.value);
              }}
            >
              <option value="">All channels</option>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="sr-only">Provider filter</span>
            <select
              className={inputClass}
              value={provider}
              onChange={(event) => {
                setPage(1);
                setProvider(event.target.value);
              }}
            >
              <option value="">All providers</option>
              <option value="TEST">Test</option>
              <option value="CUSTOM_HTTP">Live / Custom HTTP</option>
            </select>
          </label>
        </div>
        {canExport ? (
          <p className="text-xs text-stone-500">
            Export report follows your current filters (up to 5,000 rows).
          </p>
        ) : null}
      </Panel>

      <Panel>
        {loading ? (
          <p className="p-6 text-sm text-stone-600">Loading delivery results…</p>
        ) : items.length === 0 ? (
          <EmptyState
            title={hasFilters ? "No matching results" : "No delivery results yet"}
            description={
              hasFilters
                ? "Try another filter, or clear filters."
                : "Results appear after messages are processed."
            }
            actionHref={hasFilters ? undefined : "/dashboard/messages"}
            actionLabel={hasFilters ? undefined : "Send Message"}
            secondaryHref={
              hasFilters ? undefined : "/dashboard/queue?status=PENDING"
            }
            secondaryLabel={hasFilters ? undefined : "View Pending"}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Mobile</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    Template
                  </th>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">
                    Provider
                  </th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">
                    When
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const hint = getCustomerDeliveryStatusHint(item.status);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-stone-100 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-stone-900">
                        {item.contactName}
                      </td>
                      <td className="px-4 py-3 text-stone-700">
                        {item.contactMobile}
                      </td>
                      <td className="hidden px-4 py-3 text-stone-600 md:table-cell">
                        {item.templateName}
                      </td>
                      <td className="px-4 py-3 text-stone-700">{item.channel}</td>
                      <td className="hidden px-4 py-3 text-stone-600 lg:table-cell">
                        {providerLabel(item.channel, item.provider)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <StatusBadge
                            label={getCustomerDeliveryStatusLabel(item.status)}
                            tone={deliveryStatusTone(item.status)}
                          />
                          {hint ? (
                            <span className="max-w-[14rem] text-xs text-stone-500">
                              {hint}
                            </span>
                          ) : null}
                          {item.errorMessage ? (
                            <span className="max-w-[14rem] truncate text-xs text-red-700">
                              {item.errorMessage}
                            </span>
                          ) : null}
                          {item.mediaFilename ? (
                            <span className="max-w-[14rem] text-xs text-stone-600">
                              {item.mediaSimulated
                                ? "Simulated with video"
                                : "Submitted with video"}{" "}
                              · {item.mediaFilename}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-stone-600 sm:table-cell">
                        {formatCustomerDateTime(item.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canRefreshDelivery(item) ? (
                          <button
                            type="button"
                            disabled={refreshingId === item.id}
                            onClick={() => void handleRefresh(item.id)}
                            className={compactSecondaryButtonClass}
                          >
                            {refreshingId === item.id
                              ? "Refreshing…"
                              : "Refresh"}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {meta && meta.totalPages > 1 ? (
        <div className="flex flex-col gap-3 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Page {meta.page} of {meta.totalPages} ({meta.total} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className={secondaryButtonClass}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className={secondaryButtonClass}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

export function DeliveriesPageClient({ canExport }: DeliveriesPageClientProps) {
  return (
    <Suspense
      fallback={
        <PageShell wide>
          <p className="text-sm text-stone-600">Loading delivery results…</p>
        </PageShell>
      }
    >
      <DeliveriesPageContent canExport={canExport} />
    </Suspense>
  );
}
