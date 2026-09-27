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
import { getDeliveriesDict } from "@/lib/i18n/dictionaries/deliveries";
import { useLocale } from "@/lib/i18n/use-locale";
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
  const dict = getDeliveriesDict(useLocale()).deliveries;
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
          setError(body.error?.message ?? dict.errors.couldNotLoad);
          return;
        }

        setItems(body.data);
        setMeta(body.meta);
      } catch {
        setError(dict.errors.couldNotLoadRetry);
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
        setError(body?.error?.message ?? dict.errors.couldNotExport);
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
      setError(dict.errors.couldNotExportRetry);
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
          message: body.error?.message ?? dict.errors.failedToRefreshStatus,
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
          (result.result === "refreshed" ? dict.refreshedStatus : dict.checkedStatus),
      });
      reloadDeliveries();
    } catch {
      setRefreshFeedback({
        deliveryLogId,
        tone: "error",
        message: dict.errors.failedToRefreshStatus,
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
        title={dict.pageTitle}
        actions={
          <>
            {canExport ? (
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={exporting || loading}
                className={secondaryButtonClass}
              >
                {exporting ? dict.exporting : dict.exportReport}
              </button>
            ) : null}
            <SecondaryButtonLink href="/dashboard/queue?status=PENDING">
              {dict.viewScheduled}
            </SecondaryButtonLink>
          </>
        }
      />

      {items.some((item) => item.provider === "TEST") ? (
        <InlineAlert tone="info">{dict.testMessagesNote}</InlineAlert>
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
            {dict.statusLabel}
          </p>
          <StatusFilterChips
            options={DELIVERY_REPORT_FILTERS}
            value={
              status === "" || PRIMARY_STATUS_VALUES.has(status)
                ? status
                : "__other__"
            }
            onChange={applyStatus}
            ariaLabel={dict.ariaLabelStatusFilters}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="sr-only">{dict.searchContact}</span>
            <input
              className={inputClass}
              placeholder={dict.searchContact}
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
            />
          </label>
          <label className="block text-sm">
            <span className="sr-only">{dict.moreStatusesLabel}</span>
            <select
              className={inputClass}
              value={moreStatusValue}
              onChange={(event) => applyStatus(event.target.value)}
            >
              <option value="">{dict.moreStatusesOption}</option>
              {DELIVERY_MORE_STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="sr-only">{dict.channelFilterLabel}</span>
            <select
              className={inputClass}
              value={channel}
              onChange={(event) => {
                setPage(1);
                setChannel(event.target.value);
              }}
            >
              <option value="">{dict.allChannels}</option>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="sr-only">{dict.providerFilterLabel}</span>
            <select
              className={inputClass}
              value={provider}
              onChange={(event) => {
                setPage(1);
                setProvider(event.target.value);
              }}
            >
              <option value="">{dict.allProviders}</option>
              <option value="TEST">{dict.testProvider}</option>
              <option value="CUSTOM_HTTP">{dict.liveCustomHttp}</option>
            </select>
          </label>
        </div>
        {canExport ? (
          <p className="text-xs text-stone-500">{dict.exportFollowsFilters}</p>
        ) : null}
      </Panel>

      <Panel>
        {loading ? (
          <p className="p-6 text-sm text-stone-600">{dict.loadingResults}</p>
        ) : items.length === 0 ? (
          <EmptyState
            title={hasFilters ? dict.emptyTitleFiltered : dict.emptyTitleDefault}
            description={
              hasFilters ? dict.emptyDescFiltered : dict.emptyDescDefault
            }
            actionHref={hasFilters ? undefined : "/dashboard/messages"}
            actionLabel={hasFilters ? undefined : dict.sendMessageAction}
            secondaryHref={
              hasFilters ? undefined : "/dashboard/queue?status=PENDING"
            }
            secondaryLabel={hasFilters ? undefined : dict.viewPendingAction}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                <tr>
                  <th className="px-4 py-3 font-medium">{dict.table.contact}</th>
                  <th className="px-4 py-3 font-medium">{dict.table.mobile}</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    {dict.table.template}
                  </th>
                  <th className="px-4 py-3 font-medium">{dict.table.channel}</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">
                    {dict.table.provider}
                  </th>
                  <th className="px-4 py-3 font-medium">{dict.table.status}</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">
                    {dict.table.when}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">{dict.table.actionsSr}</span>
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
                                ? dict.simulatedWithVideo
                                : dict.submittedWithVideo}{" "}
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
                              ? dict.refreshing
                              : dict.refresh}
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
          <span>{dict.pageOf(meta.page, meta.totalPages, meta.total)}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className={secondaryButtonClass}
            >
              {dict.previous}
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className={secondaryButtonClass}
            >
              {dict.next}
            </button>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

export function DeliveriesPageClient({ canExport }: DeliveriesPageClientProps) {
  const dict = getDeliveriesDict(useLocale()).deliveries;
  return (
    <Suspense
      fallback={
        <PageShell wide>
          <p className="text-sm text-stone-600">{dict.loadingResults}</p>
        </PageShell>
      }
    >
      <DeliveriesPageContent canExport={canExport} />
    </Suspense>
  );
}
