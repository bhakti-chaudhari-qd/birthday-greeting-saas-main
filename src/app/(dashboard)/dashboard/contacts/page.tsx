import { redirect } from "next/navigation";

import { ContactsPageClient } from "@/components/contacts/contacts-page-client";
import { getAuthContext } from "@/lib/auth/context";
import { organizationRoleCanExportContacts } from "@/lib/auth/org-role-labels";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/login");
  }

  return (
    <ContactsPageClient
      canExport={organizationRoleCanExportContacts(auth.role)}
    />
  );
}
