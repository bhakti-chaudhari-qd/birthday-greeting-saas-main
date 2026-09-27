"use client";

import Link from "next/link";

import { TemplateForm, type TemplateFormChannel } from "@/components/templates/template-form";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";
import { getTemplatesDict } from "@/lib/i18n/dictionaries/templates";
import { useLocale } from "@/lib/i18n/use-locale";

type EditTemplateInitialValues = {
  name: string;
  occasionId: string;
  categoryId: string;
  isActive: boolean;
  body: string;
  emailSubject: string;
  whatsappTemplateName: string;
  whatsappProviderTemplateId: string;
  whatsappLanguage: string;
  whatsappMediaAssetId: string | null;
  whatsappMediaKind: "IMAGE" | "VIDEO" | null;
  whatsappMediaPreviewUrl: string | null;
  dltTemplateId: string;
  dltApprovedContent: string;
  includePersonalizedPdf: boolean;
  documentTemplateId: string | null;
};

export function EditTemplatePageClient({
  templateId,
  channel,
  initialValues,
}: {
  templateId: string;
  channel: TemplateFormChannel;
  initialValues: EditTemplateInitialValues;
}) {
  const dict = getTemplatesDict(useLocale()).editPage;

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
      <PageHeader title={channelTitles[channel] ?? dict.titleFallback} />
      <Panel className="p-5">
        <TemplateForm
          mode="edit"
          channel={channel}
          templateId={templateId}
          initialValues={initialValues}
        />
      </Panel>
    </PageShell>
  );
}
