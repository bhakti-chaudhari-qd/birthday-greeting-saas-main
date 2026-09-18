"use client";

import Link from "next/link";

import { getContactsDict } from "@/lib/i18n/dictionaries/contacts";
import { useLocale } from "@/lib/i18n/use-locale";

type ContactFormPageHeaderProps = {
  mode: "create" | "edit";
};

export function ContactFormBackLink() {
  const dict = getContactsDict(useLocale()).form;

  return (
    <Link
      href="/dashboard/contacts"
      className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <span aria-hidden>←</span> {dict.back}
    </Link>
  );
}

export function ContactFormPageTitle({ mode }: ContactFormPageHeaderProps) {
  const dict = getContactsDict(useLocale()).form;

  return (
    <>{mode === "create" ? dict.addContactTitle : dict.editContactTitle}</>
  );
}
