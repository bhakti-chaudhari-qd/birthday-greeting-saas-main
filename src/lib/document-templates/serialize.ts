import type { DocumentTemplate, Prisma } from "@prisma/client";

export type DocumentTemplateWithOccasion = Omit<
  DocumentTemplate,
  "bytes" | "layoutJson"
> & {
  occasion?: { id: string; name: string } | null;
};

export function serializeDocumentTemplate(
  template: DocumentTemplateWithOccasion,
) {
  return {
    id: template.id,
    name: template.name,
    occasionId: template.occasionId,
    occasionName: template.occasion?.name ?? null,
    fileName: template.fileName,
    contentType: template.contentType,
    byteLength: template.byteLength,
    fileUrl: `/api/v1/document-templates/${template.id}/file`,
    isActive: template.isActive,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export type SerializedDocumentTemplate = ReturnType<
  typeof serializeDocumentTemplate
>;

export function buildDocumentTemplateListWhere(
  organizationId: string,
  query: {
    search?: string;
    occasionId?: string;
    isActive: "true" | "false" | "all";
  },
): Prisma.DocumentTemplateWhereInput {
  const where: Prisma.DocumentTemplateWhereInput = { organizationId };

  if (query.isActive === "true") {
    where.isActive = true;
  } else if (query.isActive === "false") {
    where.isActive = false;
  }

  if (query.occasionId) {
    where.occasionId = query.occasionId;
  }

  if (query.search) {
    where.name = { contains: query.search, mode: "insensitive" };
  }

  return where;
}
