"use client";

import { CategoryAutomationTable } from "@/components/automation/category-automation-table";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function GreetingRoutesSettingsPage() {
  return (
    <PageShell>
      <PageHeader title="Automatic greetings" />
      <p className="text-sm text-stone-600">
        Automatic greetings use India Standard Time (IST). Send times below are
        IST wall-clock times.
      </p>
      <CategoryAutomationTable />
    </PageShell>
  );
}
