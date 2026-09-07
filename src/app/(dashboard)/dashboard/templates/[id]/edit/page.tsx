import Link from "next/link";
import { notFound } from "next/navigation";

import { TemplateForm } from "@/components/templates/template-form";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";
import { requireDashboardAdmin } from "@/lib/auth/dashboard-guard";
import { TemplateNotFoundError } from "@/lib/templates/errors";
import { serializeTemplate } from "@/lib/templates/serialize";
import { getTemplate } from "@/lib/templates/service";

type PageProps = {
  params: Promise<{ id: string }>;
};

const CHANNEL_TITLES: Record<string, string> = {
  SMS: "Edit SMS template",
  WHATSAPP: "Edit WhatsApp template",
  EMAIL: "Edit Email template",
};

export default async function EditTemplatePage({ params }: PageProps) {
  const [{ id }, auth] = await Promise.all([params, requireDashboardAdmin()]);

  let template;
  try {
    template = await getTemplate(auth.organizationId, id);
  } catch (error) {
    if (error instanceof TemplateNotFoundError) {
      notFound();
    }

    throw error;
  }

  const serialized = serializeTemplate(template);

  return (
    <PageShell>
      <Link
        href="/dashboard/templates"
        className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 outline-none hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <span aria-hidden>←</span> Back to Manage Templates
      </Link>
      <PageHeader title={CHANNEL_TITLES[serialized.channel] ?? "Edit template"} />
      <Panel className="p-5">
        <TemplateForm
          mode="edit"
          channel={serialized.channel}
          templateId={serialized.id}
          initialValues={{
            name: serialized.name,
            occasionId: serialized.occasionId,
            categoryId: serialized.categoryId ?? "",
            isActive: serialized.isActive,
            body: serialized.body,
            emailSubject: serialized.emailSubject ?? "",
            whatsappTemplateName: serialized.whatsappTemplateName ?? "",
            whatsappProviderTemplateId:
              serialized.whatsappProviderTemplateId ?? "",
            whatsappLanguage: serialized.whatsappLanguage ?? "en",
            whatsappMediaAssetId: serialized.whatsappMediaAssetId,
            whatsappMediaKind: serialized.whatsappMediaKind,
            whatsappMediaPreviewUrl: serialized.whatsappMediaPreviewUrl,
            dltTemplateId: template.dltTemplateId ?? "",
            dltApprovedContent: template.dltApprovedContent ?? "",
            includePersonalizedPdf: serialized.includePersonalizedPdf,
            documentTemplateId: serialized.documentTemplateId,
          }}
        />
      </Panel>
    </PageShell>
  );
}
