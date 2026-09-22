"use client";

import Link from "next/link";

import { AddClientForm } from "@/components/admin/add-client-form";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";
import { getAdminClientNewDict } from "@/lib/i18n/dictionaries/admin-client-new";
import { useLocale } from "@/lib/i18n/use-locale";

export default function NewAdminClientPage() {
  const dict = getAdminClientNewDict(useLocale());

  return (
    <PageShell>
      <PageHeader
        title={dict.title}
        description={dict.description}
        actions={
          <Link
            href="/admin/organizations"
            className="text-sm font-medium text-primary hover:underline"
          >
            {dict.backToClients}
          </Link>
        }
      />
      <Panel className="p-5">
        <AddClientForm />
      </Panel>
    </PageShell>
  );
}
