import { DocumentEditorPageClient } from "@/components/document-templates/document-editor-page-client";

export default async function DocumentTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentEditorPageClient templateId={id} />;
}
