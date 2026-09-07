import type { MessageTemplate, Prisma } from "@prisma/client";

import {
  previewTemplate,
  renderTemplate,
  SUPPORTED_TEMPLATE_VARIABLES,
  TEMPLATE_PREVIEW_VALUES,
} from "@/lib/templates/variables";
import { resolveWhatsAppMediaKind } from "@/lib/templates/whatsapp-template-name";

import { checkDltCompatibility } from "./dlt-compatibility";
import { deriveRealSmsReadiness } from "./readiness";

export type TemplateWithCategory = MessageTemplate & {
  category?: { id: string; name: string } | null;
  occasion?: { id: string; name: string } | null;
  whatsappMediaAsset?: { contentType: string } | null;
  documentTemplate?: { id: string; name: string } | null;
};

export function serializeTemplate(template: TemplateWithCategory) {
  const readiness = deriveRealSmsReadiness(template);
  const whatsappMediaContentType =
    template.whatsappMediaAsset?.contentType ?? null;
  const whatsappMediaKind = resolveWhatsAppMediaKind({
    contentType: whatsappMediaContentType,
    name: template.name,
  });

  return {
    id: template.id,
    name: template.name,
    occasionId: template.occasionId,
    occasionName: template.occasion?.name ?? null,
    channel: template.channel,
    body: template.body,
    emailSubject: template.emailSubject,
    categoryId: template.categoryId,
    categoryName: template.category?.name ?? null,
    contentPreview: previewTemplate(template.body),
    previewMessage: renderTemplate(template.body, TEMPLATE_PREVIEW_VALUES),
    variables: template.variables,
    supportedVariables: [...SUPPORTED_TEMPLATE_VARIABLES],
    dltTemplateId: template.dltTemplateId,
    whatsappTemplateName: template.whatsappTemplateName,
    whatsappProviderTemplateId: template.whatsappProviderTemplateId,
    whatsappLanguage: template.whatsappLanguage,
    whatsappParameterOrder: template.whatsappParameterOrder,
    whatsappMediaAssetId: template.whatsappMediaAssetId,
    whatsappMediaContentType,
    whatsappMediaKind,
    whatsappMediaPreviewUrl: template.whatsappMediaAssetId
      ? `/api/v1/whatsapp-media/${template.whatsappMediaAssetId}`
      : null,
    providerApproved: false,
    includePersonalizedPdf: template.includePersonalizedPdf,
    documentTemplateId: template.documentTemplateId,
    documentTemplateName: template.documentTemplate?.name ?? null,
    isActive: template.isActive,
    realSmsReady: readiness.realSmsReady,
    realSmsReadinessIssues: readiness.realSmsReadinessIssues,
    realSmsStatusLabel: readiness.realSmsStatusLabel,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export type SerializedTemplate = ReturnType<typeof serializeTemplate>;

export function serializeTemplateSmsSetup(template: MessageTemplate) {
  const readiness = deriveRealSmsReadiness(template);
  const compatibility = template.dltApprovedContent
    ? checkDltCompatibility(template.body, template.dltApprovedContent)
    : { compatible: false, issues: ["Approved DLT content is required"] };

  return {
    id: template.id,
    name: template.name,
    channel: template.channel,
    occasionId: template.occasionId,
    body: template.body,
    dltTemplateId: template.dltTemplateId,
    dltApprovedContent: template.dltApprovedContent,
    compatibility: {
      compatible: compatibility.compatible,
      issues: compatibility.issues,
    },
    realSmsReady: readiness.realSmsReady,
    realSmsReadinessIssues: readiness.realSmsReadinessIssues,
    realSmsStatusLabel: readiness.realSmsStatusLabel,
    requiresPairReviewAcknowledgement: Boolean(
      template.dltTemplateId?.trim() || template.dltApprovedContent?.trim(),
    ),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export type SerializedTemplateSmsSetup = ReturnType<
  typeof serializeTemplateSmsSetup
>;

/** Shared (All) templates plus templates scoped to this contact group. */
export function templateMatchesAutomationCategory(
  templateCategoryId: string | null | undefined,
  ruleCategoryId: string | null,
): boolean {
  if (!ruleCategoryId) {
    return templateCategoryId == null;
  }
  return templateCategoryId == null || templateCategoryId === ruleCategoryId;
}

export function buildTemplateListWhere(
  organizationId: string,
  query: {
    search?: string;
    occasionId?: string;
    channel?: "SMS" | "WHATSAPP" | "EMAIL";
    categoryId?: "all" | string;
    isActive: "true" | "false" | "all";
  },
): Prisma.MessageTemplateWhereInput {
  const where: Prisma.MessageTemplateWhereInput = { organizationId };

  if (query.isActive === "true") {
    where.isActive = true;
  } else if (query.isActive === "false") {
    where.isActive = false;
  }

  if (query.occasionId) {
    where.occasionId = query.occasionId;
  }

  if (query.channel) {
    where.channel = query.channel;
  }

  if (query.categoryId === "all") {
    where.categoryId = null;
  } else if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.search) {
    where.name = { contains: query.search, mode: "insensitive" };
  }

  return where;
}
