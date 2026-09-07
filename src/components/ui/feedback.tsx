import type { ReactNode } from "react";

import {
  PrimaryButtonLink,
  SecondaryButtonLink,
  secondaryButtonClass,
} from "@/components/ui/page";

type EmptyStateProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  /** Use instead of secondaryHref when the action opens a dialog rather than navigating. */
  secondaryOnClick?: () => void;
};

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  secondaryHref,
  secondaryLabel,
  secondaryOnClick,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-4 px-5 py-10 sm:px-8">
      <div className="max-w-md">
        <h2 className="text-base font-semibold text-stone-900">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
          {description}
        </p>
      </div>
      {actionHref && actionLabel ? (
        <div className="flex flex-wrap gap-2">
          <PrimaryButtonLink href={actionHref}>{actionLabel}</PrimaryButtonLink>
          {secondaryHref && secondaryLabel ? (
            <SecondaryButtonLink href={secondaryHref}>
              {secondaryLabel}
            </SecondaryButtonLink>
          ) : null}
          {secondaryOnClick && secondaryLabel ? (
            <button
              type="button"
              onClick={secondaryOnClick}
              className={secondaryButtonClass}
            >
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PageHint({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="status"
      className="rounded-lg border border-sky-200 border-l-4 border-l-sky-600 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-950 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
        Tip
      </p>
      <div className="mt-1">{children}</div>
      {action ? <div className="mt-3 flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export function InlineAlert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info" | "warning";
  children: ReactNode;
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    info: "border-stone-200 bg-stone-50 text-stone-900",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
  }[tone];

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${styles}`}
    >
      {children}
    </p>
  );
}

export function StatusBadge({
  label,
  tone = "neutral",
  detail,
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "scheduled";
  /** Optional secondary line (e.g. send time for scheduled greetings). */
  detail?: string;
}) {
  const styles = {
    neutral: "bg-stone-100 text-stone-700 ring-stone-200",
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    warning: "bg-amber-50 text-amber-900 ring-amber-200",
    danger: "bg-red-50 text-red-800 ring-red-200",
    info: "bg-sky-50 text-sky-900 ring-sky-200",
    scheduled: "bg-sky-50 text-sky-950 ring-sky-200",
  }[tone];

  if (detail) {
    return (
      <span
        className={`inline-flex max-w-[11rem] flex-col items-end gap-1 rounded-lg px-2.5 py-1.5 text-right ring-1 ring-inset ${styles}`}
      >
        <span className="text-xs font-semibold tracking-tight">{label}</span>
        <span className="rounded-md bg-amber-200 px-1.5 py-0.5 text-[11px] font-semibold leading-snug text-amber-950">
          {detail}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles}`}
    >
      {label}
    </span>
  );
}

export function deliveryStatusTone(
  status: string,
): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "DELIVERED":
    case "READ":
    case "SENT":
      return "success";
    case "QUEUED":
      return "neutral";
    case "UNDELIVERED":
      return "warning";
    case "FAILED":
      return "danger";
    default:
      return "neutral";
  }
}

export function queueStatusTone(
  status: string,
): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "PENDING":
      return "warning";
    case "SENDING":
      return "neutral";
    case "SENT":
    case "DELIVERED":
      return "success";
    case "FAILED":
      return "danger";
    case "SKIPPED":
      return "neutral";
    default:
      return "neutral";
  }
}

