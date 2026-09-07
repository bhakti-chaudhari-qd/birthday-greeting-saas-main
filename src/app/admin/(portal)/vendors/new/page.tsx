import Link from "next/link";

import { CreateVendorForm } from "@/components/admin/create-vendor-form";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";

export default function NewAdminVendorPage() {
  return (
    <PageShell>
      <PageHeader
        title="Create vendor"
        description="Create the vendor record and send its secure registration invitation by SMS."
        actions={
          <Link
            href="/admin/vendors"
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to vendors
          </Link>
        }
      />
      <Panel className="p-5">
        <CreateVendorForm />
      </Panel>
    </PageShell>
  );
}
