"use client";

import { PageHeader, PageShell } from "@/components/ui/page";
import { BillingSettingsClient } from "@/components/billing/billing-settings-client";
import { getBillingDict } from "@/lib/i18n/dictionaries/billing";
import { useLocale } from "@/lib/i18n/use-locale";

export default function BillingSettingsPage() {
  const dict = getBillingDict(useLocale());
  return (
    <PageShell>
      <PageHeader title={dict.page.title} />
      <BillingSettingsClient />
    </PageShell>
  );
}
