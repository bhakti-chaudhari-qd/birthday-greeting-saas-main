import Link from "next/link";
import { redirect } from "next/navigation";

import { ContactForm } from "@/components/contacts/contact-form";
import { getAuthContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/dashboard/contacts"
        className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <span aria-hidden>←</span> Back
      </Link>

      <h1 className="mb-6 mt-2 text-2xl font-semibold tracking-tight text-stone-900">
        Add Contact
      </h1>

      <ContactForm mode="create" />
    </main>
  );
}
