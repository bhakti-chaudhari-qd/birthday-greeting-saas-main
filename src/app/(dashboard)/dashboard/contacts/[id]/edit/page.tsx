import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";

import { ContactDeleteButton } from "@/components/contacts/contact-delete-button";
import { ContactForm } from "@/components/contacts/contact-form";
import {
  ContactFormBackLink,
  ContactFormPageTitle,
} from "@/components/contacts/contact-form-page-header";
import { getAuthContext } from "@/lib/auth/context";
import { ContactNotFoundError } from "@/lib/contacts/errors";
import { getContactById, serializeContact } from "@/lib/contacts/service";

type EditContactPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditContactPage({ params }: EditContactPageProps) {
  const auth = await getAuthContext();

  if (!auth) {
    notFound();
  }

  const { id } = await params;
  let contact;

  try {
    contact = await getContactById(auth.organizationId, id);
  } catch (error) {
    if (error instanceof ContactNotFoundError) {
      notFound();
    }

    throw error;
  }

  const serialized = serializeContact(contact, {
    maskAdminAdded: auth.role !== UserRole.ADMIN,
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <ContactFormBackLink />

      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          <ContactFormPageTitle mode="edit" />
        </h1>
        <ContactDeleteButton
          contactId={contact.id}
          contactName={contact.name}
          redirectTo="/dashboard/contacts"
        />
      </div>

      <ContactForm
        mode="edit"
        contactId={contact.id}
        maskedContact={serialized.mobileMasked}
        initialValues={{
          name: contact.name,
          mobile: serialized.mobile,
          email: serialized.email ?? "",
          occasionDates: serialized.occasionDates,
          categoryId: contact.categoryId ?? "",
          categoryTagIds: serialized.categoryTagIds,
          address: contact.address ?? "",
          note: contact.note ?? "",
          attributes: serialized.attributes as Record<string, string>,
          isActive: contact.isActive,
        }}
      />
    </main>
  );
}
