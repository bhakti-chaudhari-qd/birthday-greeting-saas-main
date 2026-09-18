import { redirect } from "next/navigation";

import { ContactForm } from "@/components/contacts/contact-form";
import {
  ContactFormBackLink,
  ContactFormPageTitle,
} from "@/components/contacts/contact-form-page-header";
import { getAuthContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <ContactFormBackLink />

      <h1 className="mb-6 mt-2 text-2xl font-semibold tracking-tight text-stone-900">
        <ContactFormPageTitle mode="create" />
      </h1>

      <ContactForm mode="create" />
    </main>
  );
}
