"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Channel } from "@prisma/client";

import { useOccasions } from "@/components/occasions/use-occasions";
import { InlineAlert, StatusBadge } from "@/components/ui/feedback";
import {
  Panel,
  compactSecondaryButtonClass,
  inputClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import { AMBIGUOUS_PROVIDER_OUTCOME } from "@/lib/queue/constants";
import { formatDisplayDate } from "@/lib/ui/datetime";

type OrgCategory = { id: string; name: string };

type ActivityStatusFilter = "all" | "sent" | "failed" | "pending";

type ActivityRecipientRow = {
  queueId: string;
  contactName: string;
  categoryName: string;
  channel: Channel;
  status: "sent" | "failed" | "pending";
  statusLabel: string;
  sentAt: string | null;
  failureReason: string | null;
  lastErrorCode: string | null;
  canRetry: boolean;
};

type ActivityGroup = {
  key: string;
  title: string;
  occasionLabel: string | null;
  categoryName: string | null;
  scheduledDate: string;
  executedAtLabel: string;
  executedAt: string;
  counts: { sent: number; failed: number; pending: number; total: number };
  recipients: ActivityRecipientRow[];
};

type GroupedActivityResult = {
  startDate: string;
  endDate: string;
  summary: { sent: number; failed: number; pending: number; total: number };
  groups: ActivityGroup[];
  pagination: { nextCursor: string | null; hasMore: boolean };
};

export type ActivityPageClientProps = {
  canManage: boolean;
  categories: OrgCategory[];
  initialSearch: string;
  initialStatus: ActivityStatusFilter;
  initialChannel: "" | Channel;
  initialOccasionId: string;
  initialCategoryId: string;
  initialStartDate: string;
  initialEndDate: string;
  todayDate: string;
};

const CHANNEL_LABEL: Record<Channel, string> = {
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
};

const STATUS_FILTER_LABEL: Record<ActivityStatusFilter, string> = {
  all: "All statuses",
  sent: "Sent",
  failed: "Failed",
  pending: "Pending",
};

const SEARCH_DEBOUNCE_MS = 300;

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
      aria-hidden="true"
    >
      <path d="M16.5 10a6.5 6.5 0 1 1-2.1-4.8" />
      <path d="M16.5 3.5v3.2h-3.2" />
    </svg>
  );
}

function ClockHistoryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-8 w-8"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4.5h4.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "warning" | "neutral";
}) {
  const valueClass = {
    success: "text-emerald-700",
    danger: "text-red-700",
    warning: "text-amber-700",
    neutral: "text-stone-900",
  }[tone];

  return (
    <div className="rounded-xl border border-stone-200/80 bg-white px-4 py-3 sm:px-5 sm:py-3.5">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

/** Success reads "Success" (not the backend's raw "Sent"/"Delivered"); Sending shows as its own "Processing" tone. */
function recipientStatusDisplay(
  recipient: ActivityRecipientRow,
): { label: string; tone: "success" | "danger" | "warning" | "info" } {
  if (recipient.status === "sent") return { label: "Success", tone: "success" };
  if (recipient.status === "failed") return { label: "Failed", tone: "danger" };
  if (recipient.statusLabel === "Sending") return { label: "Processing", tone: "info" };
  return { label: "Pending", tone: "warning" };
}

function RecipientRow({
  recipient,
  canManage,
  onRetry,
  retrying,
}: {
  recipient: ActivityRecipientRow;
  canManage: boolean;
  onRetry: () => void;
  retrying: boolean;
}) {
  const display = recipientStatusDisplay(recipient);

  return (
    <tr className="border-b border-stone-100 last:border-0">
      <td className="px-3 py-2.5">
        <div className="font-medium text-stone-900">{recipient.contactName}</div>
        {recipient.failureReason ? (
          <div className="mt-0.5 text-xs text-red-600">{recipient.failureReason}</div>
        ) : null}
      </td>
      <td className="px-3 py-2.5 text-stone-600">{CHANNEL_LABEL[recipient.channel]}</td>
      <td className="px-3 py-2.5">
        <StatusBadge label={display.label} tone={display.tone} />
      </td>
      <td className="px-3 py-2.5 text-stone-600">
        {recipient.sentAt
          ? new Intl.DateTimeFormat("en-US", {
              timeZone: "Asia/Kolkata",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }).format(new Date(recipient.sentAt))
          : "—"}
      </td>
      <td className="px-3 py-2.5 text-right">
        {recipient.canRetry && canManage ? (
          <button
            type="button"
            className={compactSecondaryButtonClass}
            disabled={retrying}
            onClick={onRetry}
          >
            {retrying ? "Retrying…" : "Retry"}
          </button>
        ) : (
          <span className="text-stone-400">—</span>
        )}
      </td>
    </tr>
  );
}

function ActivityLoadingSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading activity">
      <span className="sr-only">Loading activity</span>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-xl border border-stone-200/80 bg-white px-5 py-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-full max-w-xs space-y-2">
              <div className="h-4 rounded bg-stone-200" />
              <div className="h-3 w-40 rounded bg-stone-200" />
            </div>
            <div className="h-4 w-20 rounded bg-stone-200" />
          </div>
          <div className="mt-4 flex gap-4">
            <div className="h-4 w-20 rounded bg-stone-200" />
            <div className="h-4 w-24 rounded bg-stone-200" />
            <div className="h-4 w-24 rounded bg-stone-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function GroupCard({
  group,
  todayDate,
  canManage,
  expanded,
  onToggleExpanded,
  retryingId,
  onRetry,
}: {
  group: ActivityGroup;
  todayDate: string;
  canManage: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  retryingId: string | null;
  onRetry: (recipient: ActivityRecipientRow) => void;
}) {
  const dateLabel =
    group.scheduledDate === todayDate ? "Today" : formatDisplayDate(group.scheduledDate);

  return (
    <div className="rounded-xl border border-stone-200/80 bg-white px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900">{group.title}</p>
          <p className="mt-0.5 text-xs text-stone-500">
            {dateLabel} • {group.executedAtLabel}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          onClick={onToggleExpanded}
        >
          {expanded ? "Hide Details" : "View Details ›"}
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-4 text-sm">
        <span className="text-emerald-700">
          <span className="font-semibold">{group.counts.sent}</span> Sent
        </span>
        <span className="text-red-700">
          <span className="font-semibold">{group.counts.failed}</span> Failed
        </span>
        <span className="text-amber-700">
          <span className="font-semibold">{group.counts.pending}</span> Pending
        </span>
      </div>

      {expanded ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="px-3 py-2 font-medium">Recipient</th>
                <th className="px-3 py-2 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {group.recipients.map((recipient) => (
                <RecipientRow
                  key={recipient.queueId}
                  recipient={recipient}
                  canManage={canManage}
                  retrying={retryingId === recipient.queueId}
                  onRetry={() => onRetry(recipient)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function MoreFiltersPopover({
  categories,
  categoryId,
  onChangeCategory,
}: {
  categories: OrgCategory[];
  categoryId: string;
  onChangeCategory: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const active = Boolean(categoryId);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className="flex items-center gap-1.5">
          More Filters
          {active ? <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden /> : null}
        </span>
        <ChevronDownIcon />
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-stone-200 bg-white p-3 shadow-lg"
        >
          <label className="block text-sm">
            <span className="text-xs font-medium text-stone-700">Category</span>
            <select
              className={`${inputClass} mt-1`}
              value={categoryId}
              onChange={(event) => onChangeCategory(event.target.value)}
            >
              <option value="">All groups</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700 outline-none transition-colors hover:bg-stone-200 focus-visible:ring-2 focus-visible:ring-primary"
    >
      {label}
      <span aria-hidden>×</span>
    </button>
  );
}

export function ActivityPageClient({
  canManage,
  categories,
  initialSearch,
  initialStatus,
  initialChannel,
  initialOccasionId,
  initialCategoryId,
  initialStartDate,
  initialEndDate,
  todayDate,
}: ActivityPageClientProps) {
  const { occasions } = useOccasions();
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [status, setStatus] = useState<ActivityStatusFilter>(initialStatus);
  const [channel, setChannel] = useState<"" | Channel>(initialChannel);
  const [occasionId, setOccasionId] = useState(initialOccasionId);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  const [result, setResult] = useState<GroupedActivityResult | null>(null);
  const resultRef = useRef<GroupedActivityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadActivity = useCallback(
    async (mode: "initial" | "refresh" | "more") => {
      const isLoadingMore = mode === "more";
      if (isLoadingMore) {
        setLoadingMore(true);
      } else if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
        resultRef.current = null;
        setResult(null);
      }
      setError(null);
      try {
        const params = new URLSearchParams({ status, startDate, endDate });
        params.set("limit", "25");
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (channel) params.set("channel", channel);
        if (occasionId) params.set("occasionId", occasionId);
        if (categoryId) params.set("categoryId", categoryId);
        const currentResult = resultRef.current;
        if (isLoadingMore && currentResult?.pagination.nextCursor) {
          params.set("cursor", currentResult.pagination.nextCursor);
        }

        const response = await fetch(`/api/v1/activity/grouped?${params.toString()}`);
        const body = await response.json();
        if (!response.ok) {
          setError(body.error?.message ?? "Could not load activity. Try again.");
          return;
        }
        const nextResult = body.data as GroupedActivityResult;
        if (isLoadingMore && currentResult) {
          const groupsByKey = new Map(currentResult.groups.map((group) => [group.key, group]));
          for (const incoming of nextResult.groups) {
            const existing = groupsByKey.get(incoming.key);
            if (!existing) {
              groupsByKey.set(incoming.key, incoming);
              continue;
            }
            existing.counts = {
              sent: existing.counts.sent + incoming.counts.sent,
              failed: existing.counts.failed + incoming.counts.failed,
              pending: existing.counts.pending + incoming.counts.pending,
              total: existing.counts.total + incoming.counts.total,
            };
            existing.recipients = [...existing.recipients, ...incoming.recipients];
          }
          const mergedResult = { ...nextResult, groups: [...groupsByKey.values()] };
          resultRef.current = mergedResult;
          setResult(mergedResult);
        } else {
          resultRef.current = nextResult;
          setResult(nextResult);
        }
      } catch {
        setError("Could not load activity. Check your connection and try again.");
      } finally {
        if (!isLoadingMore) setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [status, startDate, endDate, debouncedSearch, channel, occasionId, categoryId],
  );

  useEffect(() => {
    async function load() {
      await loadActivity("initial");
    }
    void load();
  }, [loadActivity]);

  function toggleExpanded(key: string) {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function clearFilters() {
    setSearchInput("");
    setStatus("all");
    setChannel("");
    setOccasionId("");
    setCategoryId("");
    setStartDate(todayDate);
    setEndDate(todayDate);
  }

  async function handleRetry(recipient: ActivityRecipientRow) {
    const isAmbiguous = recipient.lastErrorCode === AMBIGUOUS_PROVIDER_OUTCOME;
    const confirmed = isAmbiguous
      ? window.confirm(
          `Retry the greeting for ${recipient.contactName}?\n\nThis may send a second message if the first already went through.`,
        )
      : window.confirm(`Retry the greeting for ${recipient.contactName}?`);
    if (!confirmed) {
      return;
    }

    setRetryingId(recipient.queueId);
    try {
      const response = await fetch(`/api/v1/queue/${recipient.queueId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmAmbiguousRetry: isAmbiguous }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? "Could not retry greeting.");
        return;
      }
      await loadActivity("refresh");
    } catch {
      setError("Could not retry greeting. Check your connection and try again.");
    } finally {
      setRetryingId(null);
    }
  }

  const summary = result?.summary ?? { sent: 0, failed: 0, pending: 0, total: 0 };
  const groups = result?.groups ?? [];
  const hasMore = result?.pagination.hasMore ?? false;
  const isSingleDay = startDate === endDate;
  const summaryPeriodLabel = isSingleDay
    ? startDate === todayDate
      ? "Today's"
      : `${formatDisplayDate(startDate)}`
    : `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`;
  const hasFilters = Boolean(
    searchInput.trim() ||
      status !== "all" ||
      channel ||
      occasionId ||
      categoryId ||
      startDate !== todayDate ||
      endDate !== todayDate,
  );

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
  if (status !== "all") {
    chips.push({
      key: "status",
      label: `Status: ${STATUS_FILTER_LABEL[status]}`,
      onRemove: () => setStatus("all"),
    });
  }
  if (occasionId) {
    chips.push({
      key: "occasion",
      label: occasions.find((occasion) => occasion.id === occasionId)?.name ?? "Occasion",
      onRemove: () => setOccasionId(""),
    });
  }
  if (channel) {
    chips.push({
      key: "channel",
      label: CHANNEL_LABEL[channel],
      onRemove: () => setChannel(""),
    });
  }
  if (categoryId) {
    const categoryName = categories.find((c) => c.id === categoryId)?.name ?? "Category";
    chips.push({ key: "category", label: categoryName, onRemove: () => setCategoryId("") });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Activity</h1>
          <p className="mt-1.5 text-sm text-stone-600">
            Track greeting deliveries and message history.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canManage ? (
            <a
              href={`/api/v1/activity/export?tab=${status === "failed" ? "failed" : status === "pending" ? "upcoming" : "sent"}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`}
              className={secondaryButtonClass}
            >
              Export CSV
            </a>
          ) : null}
          <button
            type="button"
            aria-label="Refresh activity"
            className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white p-2 text-stone-600 outline-none transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={() => void loadActivity("refresh")}
            disabled={refreshing}
          >
            <RefreshIcon spinning={refreshing} />
          </button>
        </div>
      </div>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label={`${summaryPeriodLabel} Total`} value={summary.total} tone="neutral" />
        <SummaryCard label="Sent Successfully" value={summary.sent} tone="success" />
        <SummaryCard label="Failed" value={summary.failed} tone="danger" />
        <SummaryCard label="Pending" value={summary.pending} tone="warning" />
      </div>

      <Panel className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="block min-w-0 flex-1 text-sm">
            <span className="sr-only">Search recipient</span>
            <input
              className={inputClass}
              placeholder="Search recipient..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
          <label className="block text-sm sm:w-36">
            <span className="sr-only">Status filter</span>
            <select
              className={inputClass}
              value={status}
              onChange={(event) => setStatus(event.target.value as ActivityStatusFilter)}
            >
              <option value="all">All statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </label>
          <label className="block text-sm sm:w-40">
            <span className="sr-only">Occasion filter</span>
            <select
              className={inputClass}
              value={occasionId}
              onChange={(event) => setOccasionId(event.target.value)}
            >
              <option value="">All occasions</option>
              {occasions.map((occasion) => (
                <option key={occasion.id} value={occasion.id}>
                  {occasion.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:w-36">
            <span className="sr-only">Channel filter</span>
            <select
              className={inputClass}
              value={channel}
              onChange={(event) => setChannel(event.target.value as "" | Channel)}
            >
              <option value="">All channels</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
            </select>
          </label>
          <div className="flex items-center gap-1.5">
            <label className="block text-sm sm:w-36">
              <span className="sr-only">From date</span>
              <input
                type="date"
                className={inputClass}
                value={startDate}
                max={endDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setStartDate(value);
                  if (value > endDate) setEndDate(value);
                }}
              />
            </label>
            <span className="text-stone-400" aria-hidden>
              –
            </span>
            <label className="block text-sm sm:w-36">
              <span className="sr-only">To date</span>
              <input
                type="date"
                className={inputClass}
                value={endDate}
                min={startDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setEndDate(value);
                  if (value < startDate) setStartDate(value);
                }}
              />
            </label>
          </div>
          <div className="sm:w-36">
            <MoreFiltersPopover
              categories={categories}
              categoryId={categoryId}
              onChangeCategory={setCategoryId}
            />
          </div>
        </div>
      </Panel>

      {chips.length > 0 ? (
        <div className="-mt-2 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </div>
      ) : null}

      {loading ? (
        <ActivityLoadingSkeleton />
      ) : groups.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center sm:px-8">
            <div className="text-stone-300">
              <ClockHistoryIcon />
            </div>
            <div className="max-w-sm">
              <h2 className="text-base font-semibold text-stone-900">No activity found</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                Greeting deliveries will appear here once automations start sending messages.
              </p>
            </div>
            {hasFilters ? (
              <button type="button" className={secondaryButtonClass} onClick={clearFilters}>
                Clear Filters
              </button>
            ) : null}
          </div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <GroupCard
              key={group.key}
              group={group}
              todayDate={todayDate}
              canManage={canManage}
              expanded={expandedKeys.has(group.key)}
              onToggleExpanded={() => toggleExpanded(group.key)}
              retryingId={retryingId}
              onRetry={(recipient) => void handleRetry(recipient)}
            />
          ))}
          {hasMore ? (
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => void loadActivity("more")}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading more…" : "Load more activity"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
