import { prisma } from "@/lib/db";
import type { DocumentTemplateLayout } from "@/lib/validation/document-template-layout";

import { DocumentTemplateNotFoundError } from "./errors";

async function assertTemplateForOrganization(
  organizationId: string,
  templateId: string,
): Promise<void> {
  const template = await prisma.documentTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: { id: true },
  });

  if (!template) {
    throw new DocumentTemplateNotFoundError();
  }
}

export async function saveLayout(
  organizationId: string,
  templateId: string,
  layoutJson: DocumentTemplateLayout,
): Promise<DocumentTemplateLayout> {
  await assertTemplateForOrganization(organizationId, templateId);

  await prisma.documentTemplate.update({
    where: { id: templateId },
    data: { layoutJson },
  });

  return layoutJson;
}

export async function getLayout(
  organizationId: string,
  templateId: string,
): Promise<DocumentTemplateLayout | null> {
  const template = await prisma.documentTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: { layoutJson: true },
  });

  if (!template) {
    throw new DocumentTemplateNotFoundError();
  }

  return (template.layoutJson as DocumentTemplateLayout | null) ?? null;
}
