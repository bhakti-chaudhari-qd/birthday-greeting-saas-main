import { PageHeader, PageShell } from "@/components/ui/page";
import { BillingSettingsClient } from "@/components/billing/billing-settings-client";

export default function BillingSettingsPage() {
  return (
    <PageShell>
      <PageHeader title="Billing" />
      <BillingSettingsClient />
    </PageShell>
  );
}
