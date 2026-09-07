import Link from "next/link";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

/**
 * Consistent title + description + primary actions for dashboard pages.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function PageShell({
  children,
  wide,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={[
        "mx-auto flex w-full flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10",
        wide ? "max-w-6xl" : "max-w-5xl",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-xl border border-stone-200/90 bg-white shadow-sm",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

export function PrimaryButtonLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      {children}
    </Link>
  );
}

export function SecondaryButtonLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-800 outline-none transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      {children}
    </Link>
  );
}

export const primaryButtonClass =
  "inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-800 outline-none transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** Smaller secondary control for table rows and dense action lists. */
export const compactSecondaryButtonClass =
  "inline-flex items-center justify-center whitespace-nowrap rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-sm font-medium text-stone-800 outline-none transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-primary focus:ring-2 focus:ring-primary/15";
