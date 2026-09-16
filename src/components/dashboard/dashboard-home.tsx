"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { EmptyState, InlineAlert, StatusBadge } from "@/components/ui/feedback";
import { compactSecondaryButtonClass } from "@/components/ui/page";
import type {
  DashboardHomeAlert,
  DashboardHomeStatus,
  DashboardHomeSummary,
  RunningAutomationRow,
  UpcomingTodayItem,
} from "@/lib/dashboard/home-summary";
import type { OccasionHumanStatus } from "@/lib/queue/occasions-status";
import { getOccasionStatusLabel } from "@/lib/ui/customer-labels";

export type DashboardHomeProps = {
  name: string;
  summary: DashboardHomeSummary;
  canManage?: boolean;
};

const AUTO_REFRESH_INTERVAL_MS = 60_000;

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

const STATUS_DOT_TONE_CLASS = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
} as const;

function StatusDot({ tone }: { tone: keyof typeof STATUS_DOT_TONE_CLASS }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_TONE_CLASS[tone]}`}
    />
  );
}

function StatusCard({
  label,
  children,
  href,
}: {
  label: string;
  children: React.ReactNode;
  href?: string;
}) {
  const cardClass =
    "flex min-h-[8.5rem] flex-col rounded-xl border border-stone-200/80 bg-white p-4 sm:p-5";

  if (href) {
    return (
      <Link
        href={href}
        className={`${cardClass} outline-none transition-colors hover:border-stone-300 hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
      >
        <p className="text-sm font-medium text-stone-500">{label}</p>
        {children}
      </Link>
    );
  }

  return (
    <div className={cardClass}>
      <p className="text-sm font-medium text-stone-500">{label}</p>
      {children}
    </div>
  );
}

function ChannelStatusRow({
  label,
  connected,
}: {
  label: string;
  connected: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium text-stone-800">{label}</span>
      <StatusBadge
        label={connected ? "Connected" : "Not connected"}
        tone={connected ? "success" : "danger"}
      />
    </div>
  );
}

function AutomationRowCard({ row }: { row: RunningAutomationRow }) {
  return (
    <div className="rounded-xl border border-stone-200/80 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-stone-900">
          {row.occasionLabel}
        </p>
        <StatusBadge label="Active" tone="success" />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3">
        <div>
          <dt className="text-xs text-stone-500">Category</dt>
          <dd className="mt-1 text-sm font-medium text-stone-800">
            {row.categoryName}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500">Channel</dt>
          <dd className="mt-1 text-sm font-medium text-stone-800">
            {row.channelLabel}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500">Send Time</dt>
          <dd className="mt-1 text-sm font-medium text-stone-800">
            {row.sendTimeLabel}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function upcomingStatusTone(
  status: OccasionHumanStatus,
): "neutral" | "success" | "warning" | "danger" | "info" | "scheduled" {
  if (status === "sent") return "success";
  if (status === "failed") return "danger";
  if (status === "pending" || status === "skipped") return "warning";
  if (status === "sending") return "info";
  if (status === "will_send") return "scheduled";
  return "neutral";
}

function UpcomingTodayRow({ item }: { item: UpcomingTodayItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
      <span className="w-20 shrink-0 font-medium text-stone-900">
        {item.timeLabel}
      </span>
      <span className="min-w-[6rem] flex-1 truncate text-stone-700">
        {item.occasionLabel}
      </span>
      <span className="min-w-[6rem] flex-1 truncate text-stone-700">
        {item.contactName}
      </span>
      <span className="shrink-0 text-stone-500">{item.channelLabel}</span>
      <StatusBadge
        label={getOccasionStatusLabel(item.status)}
        tone={upcomingStatusTone(item.status)}
      />
    </div>
  );
}

function AlertRow({ alert }: { alert: DashboardHomeAlert }) {
  const isDanger = alert.tone === "danger";
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-2.5 ${
        isDanger ? "bg-red-50" : "bg-amber-50"
      }`}
    >
      <p
        className={`flex items-center gap-2 text-sm ${
          isDanger ? "text-red-900" : "text-amber-900"
        }`}
      >
        <StatusDot tone={isDanger ? "danger" : "warning"} />
        {alert.message}
      </p>
      <Link href={alert.href} className={compactSecondaryButtonClass}>
        {alert.cta}
      </Link>
    </div>
  );
}

export function DashboardHome({
  name,
  summary: initialSummary,
  canManage = false,
}: DashboardHomeProps) {
  const firstName = name.trim().split(/\s+/)[0] || name;
  const [summary, setSummary] = useState(initialSummary);
  const [refreshing, setRefreshing] = useState(false);
  const [catchingUp, setCatchingUp] = useState(false);
  const [catchUpError, setCatchUpError] = useState<string | null>(null);
  const mounted = useRef(true);
  const refreshInFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function refreshSummary() {
    if (refreshInFlight.current) {
      return;
    }

    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      const response = await fetch("/api/v1/dashboard/summary");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message);
      if (mounted.current) {
        setSummary(body.data as DashboardHomeSummary);
      }
    } catch {
      // Keep showing the last known-good summary; the next tick or manual
      // refresh will retry.
    } finally {
      refreshInFlight.current = false;
      if (mounted.current) {
        setRefreshing(false);
      }
    }
  }

  async function refreshStatus() {
    if (refreshInFlight.current) {
      return;
    }

    refreshInFlight.current = true;
    try {
      const response = await fetch("/api/v1/dashboard/status");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message);
      if (mounted.current) {
        const status = body.data as DashboardHomeStatus;
        setSummary((current) => ({
          ...current,
          upcomingToday: status.upcomingToday,
        }));
      }
    } catch {
      // Keep the last known-good status until the next polling attempt.
    } finally {
      refreshInFlight.current = false;
    }
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshStatus();
      }
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  async function runCatchUp(targetDate: string) {
    setCatchingUp(true);
    setCatchUpError(null);
    try {
      const response = await fetch("/api/v1/automation/catch-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Retry failed");
      }
      await refreshSummary();
    } catch (error) {
      setCatchUpError(
        error instanceof Error ? error.message : "Retry failed",
      );
    } finally {
      setCatchingUp(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-4 pb-10 pt-3 sm:px-6 sm:pt-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Welcome, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-stone-500">
            Manage your birthday automations from one place.
          </p>
          <p className="mt-0.5 text-xs text-stone-400">
            {summary.todayDateLabel}
          </p>
        </div>
        <button
          type="button"
          aria-label="Refresh dashboard"
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white p-2 text-stone-600 outline-none transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          onClick={() => void refreshSummary()}
          disabled={refreshing}
        >
          <RefreshIcon spinning={refreshing} />
        </button>
      </header>

      {summary.missedQueue || catchUpError ? (
        <div className="mt-4 flex flex-col gap-2">
          {summary.missedQueue ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-2.5">
              <p className="flex items-center gap-2 text-sm text-amber-900">
                <StatusDot tone="warning" />
                Some greetings could not be processed yesterday (
                {summary.missedQueue.missedCount}{" "}
                {summary.missedQueue.missedCount === 1 ? "person" : "people"}{" "}
                missed).
              </p>
              <button
                type="button"
                className={compactSecondaryButtonClass}
                disabled={catchingUp}
                onClick={() => void runCatchUp(summary.missedQueue!.targetDate)}
              >
                {catchingUp ? "Retrying…" : "Retry Queue"}
              </button>
            </div>
          ) : null}
          {catchUpError ? (
            <InlineAlert tone="error">{catchUpError}</InlineAlert>
          ) : null}
        </div>
      ) : null}

      <section
        aria-labelledby="status-heading"
        className="mt-6 flex flex-col gap-3"
      >
        <h2
          id="status-heading"
          className="text-lg font-semibold text-stone-900"
        >
          System Status
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatusCard label="Automation">
            <div className="mt-3 flex items-center gap-2">
              <StatusDot tone={summary.automation.running ? "success" : "danger"} />
              <p className="text-2xl font-semibold text-stone-900">
                {summary.automation.running ? "Running" : "Paused"}
              </p>
            </div>
            <div className="mt-auto flex items-center justify-between pt-4 text-xs text-stone-500">
              <span>Next Run</span>
              <span className="text-sm font-medium text-stone-700">
                {summary.automation.nextRunLabel ?? "—"}
              </span>
            </div>
          </StatusCard>

          <StatusCard label="Today's Greetings" href="/dashboard/activity">
            <p className="mt-3 text-2xl font-semibold text-stone-900">
              {summary.scheduledTodayCount}
            </p>
            <p className="mt-auto pt-4 text-xs text-stone-500">
              Scheduled Today
            </p>
          </StatusCard>

          <StatusCard label="Contacts">
            <p className="mt-3 text-2xl font-semibold text-stone-900">
              {summary.activeContactsCount}
            </p>
            <p className="mt-auto pt-4 text-xs text-stone-500">
              Active Contacts
            </p>
          </StatusCard>

          {summary.channels ? (
            <StatusCard label="Channels">
              <div className="mt-3 flex flex-1 flex-col justify-center gap-2.5">
                <ChannelStatusRow
                  label="WhatsApp"
                  connected={summary.channels.whatsappConnected}
                />
                <ChannelStatusRow
                  label="SMS"
                  connected={summary.channels.smsConnected}
                />
              </div>
            </StatusCard>
          ) : null}
        </div>
      </section>

      <section
        aria-labelledby="attention-heading"
        className="mt-8 flex flex-col gap-3"
      >
        <h2
          id="attention-heading"
          className="text-lg font-semibold text-stone-900"
        >
          Attention Required
        </h2>
        {summary.alerts.length === 0 ? (
          <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5">
            <StatusDot tone="success" />
            <p className="text-sm text-emerald-900">
              <span className="font-medium">Everything looks good.</span>{" "}
              No action required today.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {summary.alerts.map((alert) => (
              <AlertRow key={`${alert.href}:${alert.message}`} alert={alert} />
            ))}
          </div>
        )}
      </section>

      <section
        aria-labelledby="upcoming-heading"
        className="mt-8 flex flex-col gap-3"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2
            id="upcoming-heading"
            className="text-lg font-semibold text-stone-900"
          >
            Today&apos;s Occasions
          </h2>
          {summary.upcomingToday.totalCount > 0 ? (
            <Link
              href={summary.upcomingToday.viewAllHref}
              className="text-sm font-medium text-primary outline-none hover:text-primary-hover hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              View all <span aria-hidden>→</span>
            </Link>
          ) : null}
        </div>

        {summary.upcomingToday.items.length === 0 ? (
          <div className="rounded-xl border border-stone-200/80 bg-white p-4 sm:p-5">
            <p className="text-sm text-stone-600">
              No messages scheduled for today.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 rounded-xl border border-stone-200/80 bg-white">
            {summary.upcomingToday.items.map((item) => (
              <UpcomingTodayRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section
        aria-labelledby="automations-heading"
        className="mt-8 flex flex-col gap-3"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2
            id="automations-heading"
            className="text-lg font-semibold text-stone-900"
          >
            Running Automations
          </h2>
          {canManage && summary.runningAutomations.length > 0 ? (
            <Link
              href="/dashboard/settings/greeting-routes"
              className="text-sm font-medium text-primary outline-none hover:text-primary-hover hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Manage <span aria-hidden>→</span>
            </Link>
          ) : null}
        </div>

        {summary.runningAutomations.length === 0 ? (
          <div className="rounded-xl border border-stone-200/80 bg-white">
            <EmptyState
              title="No automations yet."
              description="Create your first automation to start sending greetings automatically."
              actionHref={
                canManage ? "/dashboard/settings/greeting-routes" : undefined
              }
              actionLabel={canManage ? "Create Automation" : undefined}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summary.runningAutomations.map((row) => (
              <AutomationRowCard key={row.key} row={row} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
