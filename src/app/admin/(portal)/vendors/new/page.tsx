"use client";

import Link from "next/link";

import { CreateVendorForm } from "@/components/admin/create-vendor-form";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";
import { getAdminVendorNewDict } from "@/lib/i18n/dictionaries/admin-vendor-new";
import { useLocale } from "@/lib/i18n/use-locale";

export default function NewAdminVendorPage() {
  const dict = getAdminVendorNewDict(useLocale());

  return (
    <PageShell>
      <PageHeader
        title={dict.title}
        description={dict.description}
        actions={
          <Link
            href="/admin/vendors"
            className="text-sm font-medium text-primary hover:underline"
          >
            {dict.backToVendors}
          </Link>
        }
      />
      <Panel className="p-5">
        <CreateVendorForm />
      </Panel>
    </PageShell>
  );
}
