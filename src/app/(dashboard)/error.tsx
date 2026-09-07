"use client";

import { useEffect } from "react";

import { PageShell, PrimaryButtonLink, Panel, primaryButtonClass } from "@/components/ui/page";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell>
      <Panel className="space-y-4 p-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">
            This page could not load
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Try again, or return to the dashboard and continue from there.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryButtonClass} onClick={reset}>
            Try again
          </button>
          <PrimaryButtonLink href="/dashboard">Dashboard</PrimaryButtonLink>
        </div>
      </Panel>
    </PageShell>
  );
}
