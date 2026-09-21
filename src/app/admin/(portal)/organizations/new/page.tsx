import Link from "next/link";

import { AddClientForm } from "@/components/admin/add-client-form";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";

export default function NewAdminClientPage() {
  return (
    <PageShell>
      <PageHeader
        title="Add client"
        description="Create a client and its Owner account. The Owner signs in with the email and password set here."
        actions={
          <Link
            href="/admin/organizations"
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to clients
          </Link>
        }
      />
      <Panel className="p-5">
        <AddClientForm />
      </Panel>
    </PageShell>
  );
}
