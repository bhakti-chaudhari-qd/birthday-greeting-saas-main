import { notFound } from "next/navigation";

import { EditTemplatePageClient } from "@/components/templates/edit-template-page-client";
import { requireDashboardAdmin } from "@/lib/auth/dashboard-guard";
import { TemplateNotFoundError } from "@/lib/templates/errors";
import { serializeTemplate } from "@/lib/templates/serialize";
import { getTemplate } from "@/lib/templates/service";

type PageProps = {
  params: Promise<{ id: string }>;
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
    <EditTemplatePageClient
      templateId={serialized.id}
      channel={serialized.channel}
      initialValues={{
        name: serialized.name,
        occasionId: serialized.occasionId,
        categoryId: serialized.categoryId ?? "",
        isActive: serialized.isActive,
        body: serialized.body,
        emailSubject: serialized.emailSubject ?? "",
        whatsappTemplateName: serialized.whatsappTemplateName ?? "",
        whatsappProviderTemplateId: serialized.whatsappProviderTemplateId ?? "",
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
  );
}
