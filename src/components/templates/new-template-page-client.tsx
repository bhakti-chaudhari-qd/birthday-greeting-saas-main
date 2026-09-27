"use client";

import Link from "next/link";

import {
  TemplateForm,
  type TemplateFormChannel,
} from "@/components/templates/template-form";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";
import { getTemplatesDict } from "@/lib/i18n/dictionaries/templates";
import { useLocale } from "@/lib/i18n/use-locale";

export function NewTemplatePageClient({
  channel,
}: {
  channel: TemplateFormChannel;
}) {
  const dict = getTemplatesDict(useLocale()).newPage;

  const channelTitles: Record<TemplateFormChannel, string> = {
    SMS: dict.titleSms,
    WHATSAPP: dict.titleWhatsapp,
    EMAIL: dict.titleEmail,
  };

  return (
    <PageShell>
      <Link
        href="/dashboard/templates"
        className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <span aria-hidden>←</span> {dict.backToManageTemplates}
      </Link>
      <PageHeader title={channelTitles[channel]} />
      <Panel className="p-5">
        <TemplateForm mode="create" channel={channel} />
      </Panel>
    </PageShell>
  );
}
