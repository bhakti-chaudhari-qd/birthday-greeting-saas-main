import { ContactFieldsPageClient } from "@/components/contact-fields/contact-fields-page-client";
import { StaffContactVisibilitySettings } from "@/components/contacts/staff-contact-visibility-settings";
import { PageShell } from "@/components/ui/page";

export default function ContactFieldsPage() {
  return (
    <>
      <PageShell>
        <StaffContactVisibilitySettings />
      </PageShell>
      <ContactFieldsPageClient />
    </>
  );
}
