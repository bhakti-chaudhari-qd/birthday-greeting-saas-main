"use client";

import { CategoryAutomationTable } from "@/components/automation/category-automation-table";
import { PageHeader, PageShell } from "@/components/ui/page";
import { getGreetingRoutesDict } from "@/lib/i18n/dictionaries/greeting-routes";
import { useLocale } from "@/lib/i18n/use-locale";

export default function GreetingRoutesSettingsPage() {
  const dict = getGreetingRoutesDict(useLocale());
  return (
    <PageShell>
      <PageHeader title={dict.page.title} />
      <p className="text-sm text-stone-600">{dict.page.istNote}</p>
      <CategoryAutomationTable />
    </PageShell>
  );
}
