import { Channel, Prisma } from "@prisma/client";

import { listContactFieldDefinitions } from "@/lib/contact-fields/service";
import { prisma } from "@/lib/db";
import { DocumentTemplateNotFoundError } from "@/lib/document-templates/errors";
import { getDocumentTemplate } from "@/lib/document-templates/service";
import {
  assertWhatsAppMediaAssetForOrganization,
  WhatsAppMediaAssetError,
} from "@/lib/media/whatsapp-media-assets";
import { resolveOccasionId } from "@/lib/occasions/queries";
import { OccasionValidationError } from "@/lib/occasions/service";
import type {
  CreateTemplateInput,
  ListTemplatesQuery,
  UpdateTemplateInput,
} from "@/lib/validation/template";

import {
  TemplateDuplicateError,
  TemplateInUseError,
  TemplateNotFoundError,
  TemplateValidationError,
} from "./errors";
import {
  buildTemplateListWhere,
  serializeTemplate,
} from "./serialize";
import {
  getStarterTemplateDraft,
  listStarterTemplateDrafts,
  serializeStarterTemplateDraft,
  STARTER_TEMPLATE_CATALOG,
} from "./starter-catalog";
import {
  BUILTIN_TEMPLATE_VARIABLES,
  validateTemplateVariables,
} from "./variables";
import { normalizeWhatsAppParameterOrder } from "./whatsapp-metadata";

async function assertTemplateMedia(
  organizationId: string,
  assetId: string | null | undefined,
) {
  try {
    await assertWhatsAppMediaAssetForOrganization(organizationId, assetId);
  } catch (error) {
    if (error instanceof WhatsAppMediaAssetError) {
      throw new TemplateValidationError(error.message);
    }
    throw error;
  }
}

/** Case-insensitive name match for the same channel + category within an org. */
export async function findTemplateByNameAndChannel(
  organizationId: string,
  name: string,
  channel: Channel,
  categoryId: string | null = null,
  excludeId?: string,
) {
  const normalized = name.trim();
  const matches = await prisma.messageTemplate.findMany({
    where: {
      organizationId,
      channel,
      categoryId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return (
    matches.find(
      (template) =>
        template.name.trim().toLowerCase() === normalized.toLowerCase(),
    ) ?? null
  );
}

async function assertUniqueTemplateName(
  organizationId: string,
  name: string,
  channel: Channel,
  categoryId: string | null,
  excludeId?: string,
) {
  const existing = await findTemplateByNameAndChannel(
    organizationId,
    name,
    channel,
    categoryId,
    excludeId,
  );
  if (existing) {
    throw new TemplateDuplicateError(name.trim(), channel);
  }
}

async function assertOccasionForOrganization(
  organizationId: string,
  occasionId: string,
): Promise<string> {
  try {
    return await resolveOccasionId(organizationId, occasionId);
  } catch (error) {
    if (error instanceof OccasionValidationError) {
      throw new TemplateValidationError(error.message);
    }
    throw error;
  }
}

/**
 * Confirms a documentTemplateId exists and belongs to this org, reusing the
 * DocumentTemplate service's own org-scoped lookup rather than querying
 * DocumentTemplate directly - ownership/access rules for it stay owned by
 * that service.
 */
async function assertDocumentTemplateForOrganization(
  organizationId: string,
  documentTemplateId: string,
): Promise<void> {
  try {
    await getDocumentTemplate(organizationId, documentTemplateId);
  } catch (error) {
    if (error instanceof DocumentTemplateNotFoundError) {
      throw new TemplateValidationError("Selected document template was not found");
    }
    throw error;
  }
}

async function assertCategoryForOrganization(
  organizationId: string,
  categoryId: string | null | undefined,
): Promise<string | null> {
  if (categoryId === undefined || categoryId === null) {
    return null;
  }

  const category = await prisma.contactCategoryDefinition.findFirst({
    where: { id: categoryId, organizationId },
    select: { id: true },
  });
  if (!category) {
    throw new TemplateValidationError("Selected group was not found");
  }
  return category.id;
}

async function collectProtectedTemplateIds(organizationId: string) {
  const categoryRules = await prisma.categoryAutomationRule.findMany({
    where: { organizationId },
    select: {
      smsTemplateId: true,
      whatsappTemplateId: true,
      emailTemplateId: true,
    },
  });

  const protectedIds = new Set<string>();
  for (const rule of categoryRules) {
    if (rule.smsTemplateId) protectedIds.add(rule.smsTemplateId);
    if (rule.whatsappTemplateId) protectedIds.add(rule.whatsappTemplateId);
    if (rule.emailTemplateId) protectedIds.add(rule.emailTemplateId);
  }
  return protectedIds;
}

async function allowedTemplateVariablesForOrganization(organizationId: string) {
  const fields = await listContactFieldDefinitions(organizationId, {
    activeOnly: true,
  });
  return [...BUILTIN_TEMPLATE_VARIABLES, ...fields.map((field) => field.key)];
}

function mapTemplateInput(
  input: CreateTemplateInput | UpdateTemplateInput,
  options: { requireBody?: boolean; allowedVariables: readonly string[] },
) {
  const name =
    input.name !== undefined ? input.name.trim() : undefined;
  const body =
    input.body !== undefined ? input.body.trim() : undefined;

  if (options.requireBody && (!body || body.length === 0)) {
    throw new TemplateValidationError("Template content is required");
  }

  if (body !== undefined) {
    validateTemplateVariables(body, options.allowedVariables);
  }

  return {
    name,
    body,
    occasionId: input.occasionId,
    channel: input.channel,
    isActive: input.isActive,
    variables:
      body !== undefined
        ? validateTemplateVariables(body, options.allowedVariables)
        : undefined,
    emailSubject:
      "emailSubject" in input && input.emailSubject !== undefined
        ? input.emailSubject === null
          ? null
          : input.emailSubject.trim()
        : undefined,
    whatsappTemplateName:
      input.whatsappTemplateName !== undefined
        ? input.whatsappTemplateName.trim()
        : undefined,
    whatsappProviderTemplateId:
      "whatsappProviderTemplateId" in input &&
      input.whatsappProviderTemplateId !== undefined
        ? input.whatsappProviderTemplateId === null
          ? null
          : input.whatsappProviderTemplateId.trim()
        : undefined,
    whatsappLanguage:
      input.whatsappLanguage !== undefined
        ? input.whatsappLanguage.trim()
        : undefined,
    whatsappParameterOrder: input.whatsappParameterOrder,
    whatsappMediaAssetId:
      "whatsappMediaAssetId" in input ? input.whatsappMediaAssetId : undefined,
    includePersonalizedPdf: input.includePersonalizedPdf,
    documentTemplateId:
      "documentTemplateId" in input ? input.documentTemplateId : undefined,
  };
}

function resolveWhatsAppMetadataForCreate(
  input: CreateTemplateInput,
  allowedVariables: readonly string[],
) {
  if (input.channel !== Channel.WHATSAPP) {
    return {
      whatsappTemplateName: null,
      whatsappProviderTemplateId: null,
      whatsappLanguage: null,
      whatsappParameterOrder: [] as string[],
    };
  }

  if (!input.whatsappTemplateName?.trim()) {
    throw new TemplateValidationError(
      "WhatsApp provider template name is required",
    );
  }

  if (!input.whatsappLanguage?.trim()) {
    throw new TemplateValidationError("WhatsApp language is required");
  }

  const bodyVariables = validateTemplateVariables(input.body.trim(), allowedVariables);

  try {
    return {
      whatsappProviderTemplateId:
        input.whatsappProviderTemplateId?.trim() || null,
      whatsappTemplateName: input.whatsappTemplateName.trim(),
      whatsappLanguage: input.whatsappLanguage.trim(),
      whatsappParameterOrder: normalizeWhatsAppParameterOrder(
        input.whatsappParameterOrder,
        bodyVariables,
      ),
    };
  } catch (error) {
    throw new TemplateValidationError(
      error instanceof Error ? error.message : "Invalid WhatsApp metadata",
    );
  }
}

export async function createTemplate(
  organizationId: string,
  input: CreateTemplateInput,
) {
  const allowedVariables = await allowedTemplateVariablesForOrganization(organizationId);
  const mapped = mapTemplateInput(input, {
    requireBody: true,
    allowedVariables,
  });

  if (!mapped.name) {
    throw new TemplateValidationError("Template name is required");
  }

  if (!mapped.body) {
    throw new TemplateValidationError("Template content is required");
  }

  const categoryId = await assertCategoryForOrganization(
    organizationId,
    input.categoryId,
  );

  const existing = await findTemplateByNameAndChannel(
    organizationId,
    mapped.name,
    input.channel,
    categoryId,
  );

  if (existing) {
    if (input.replaceExisting) {
      return updateTemplate(organizationId, existing.id, {
        name: mapped.name,
        occasionId: input.occasionId,
        channel: input.channel,
        body: mapped.body,
        emailSubject: input.emailSubject,
        categoryId,
        isActive: mapped.isActive ?? true,
        whatsappTemplateName: input.whatsappTemplateName,
        whatsappProviderTemplateId: input.whatsappProviderTemplateId,
        whatsappLanguage: input.whatsappLanguage,
        whatsappParameterOrder: input.whatsappParameterOrder,
        whatsappMediaAssetId: input.whatsappMediaAssetId ?? null,
        includePersonalizedPdf: input.includePersonalizedPdf,
        documentTemplateId: input.documentTemplateId ?? null,
      });
    }
    throw new TemplateDuplicateError(mapped.name, input.channel);
  }

  const whatsappMetadata = resolveWhatsAppMetadataForCreate(input, allowedVariables);
  if (input.whatsappMediaAssetId) {
    await assertTemplateMedia(
      organizationId,
      input.whatsappMediaAssetId,
    );
  }

  if (input.channel === Channel.EMAIL && !input.emailSubject?.trim()) {
    throw new TemplateValidationError("Email subject is required");
  }

  const includePersonalizedPdf = mapped.includePersonalizedPdf ?? false;
  if (includePersonalizedPdf && !mapped.documentTemplateId) {
    throw new TemplateValidationError(
      "Select a document template to include a personalized PDF",
    );
  }
  if (mapped.documentTemplateId) {
    await assertDocumentTemplateForOrganization(
      organizationId,
      mapped.documentTemplateId,
    );
  }

  const occasionId = await assertOccasionForOrganization(
    organizationId,
    input.occasionId,
  );

  return prisma.messageTemplate.create({
    data: {
      organizationId,
      name: mapped.name,
      occasionId,
      channel: input.channel,
      body: mapped.body,
      categoryId,
      emailSubject:
        input.channel === Channel.EMAIL
          ? input.emailSubject!.trim()
          : null,
      variables: mapped.variables ?? [],
      isActive: mapped.isActive ?? true,
      whatsappTemplateName: whatsappMetadata.whatsappTemplateName,
      whatsappProviderTemplateId: whatsappMetadata.whatsappProviderTemplateId,
      whatsappLanguage: whatsappMetadata.whatsappLanguage,
      whatsappParameterOrder: whatsappMetadata.whatsappParameterOrder,
      whatsappMediaAssetId:
        input.channel === Channel.WHATSAPP
          ? input.whatsappMediaAssetId ?? null
          : null,
      includePersonalizedPdf,
      documentTemplateId: includePersonalizedPdf ? mapped.documentTemplateId : null,
    },
    include: {
        category: { select: { id: true, name: true } },
        occasion: { select: { id: true, name: true } },
        whatsappMediaAsset: { select: { contentType: true } },
        documentTemplate: { select: { id: true, name: true } },
      },
  });
}

async function findExistingStarterTemplate(
  organizationId: string,
  starter: { name: string; channel: Channel },
) {
  return prisma.messageTemplate.findFirst({
    where: {
      organizationId,
      name: starter.name,
      channel: starter.channel,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

/**
 * Keeps the oldest template for each starter name/channel and deletes unused
 * extras so the Templates list does not fill with identical starter copies.
 * Templates referenced by automation settings or send history are left alone.
 */
export async function dedupeUnusedStarterTemplates(organizationId: string) {
  return dedupeUnusedDuplicateTemplates(organizationId, {
    onlyStarterNames: true,
  });
}

/**
 * Removes unused same-name + same-channel copies (case-insensitive), keeping
 * the oldest. Protected when linked to automation or send history.
 */
export async function dedupeUnusedDuplicateTemplates(
  organizationId: string,
  options: { onlyStarterNames?: boolean } = {},
) {
  const protectedIds = await collectProtectedTemplateIds(organizationId);
  const templates = await prisma.messageTemplate.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      channel: true,
      categoryId: true,
      _count: { select: { sendQueues: true } },
    },
  });

  const starterKeys = new Set(
    STARTER_TEMPLATE_CATALOG.map(
      (starter) =>
        `${starter.channel}:${starter.name.trim().toLowerCase()}`,
    ),
  );

  const groups = new Map<string, typeof templates>();
  for (const template of templates) {
    const key = `${template.channel}:${template.name.trim().toLowerCase()}:${template.categoryId ?? "all"}`;
    if (options.onlyStarterNames && !starterKeys.has(`${template.channel}:${template.name.trim().toLowerCase()}`)) {
      continue;
    }
    const group = groups.get(key) ?? [];
    group.push(template);
    groups.set(key, group);
  }

  let deletedCount = 0;
  for (const group of groups.values()) {
    if (group.length <= 1) {
      continue;
    }
    for (const extra of group.slice(1)) {
      if (protectedIds.has(extra.id) || extra._count.sendQueues > 0) {
        continue;
      }
      await prisma.messageTemplate.delete({ where: { id: extra.id } });
      deletedCount += 1;
    }
  }

  return { deletedCount };
}

export async function listStarterTemplatesForOrganization(
  organizationId: string,
) {
  await dedupeUnusedStarterTemplates(organizationId);

  const starters = listStarterTemplateDrafts();
  if (starters.length === 0) {
    return [];
  }

  const existing = await prisma.messageTemplate.findMany({
    where: {
      organizationId,
      OR: starters.map((starter) => ({
        name: starter.name,
        channel: starter.channel,
      })),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, name: true, channel: true },
  });

  const existingByKey = new Map<string, string>();
  for (const template of existing) {
    const key = `${template.channel}:${template.name}`;
    if (!existingByKey.has(key)) {
      existingByKey.set(key, template.id);
    }
  }

  return starters.map((starter) =>
    serializeStarterTemplateDraft(starter, {
      existingTemplateId:
        existingByKey.get(`${starter.channel}:${starter.name}`) ?? null,
    }),
  );
}

export async function createTemplateFromStarter(
  organizationId: string,
  starterId: string,
) {
  const starter = getStarterTemplateDraft(starterId);

  if (!starter) {
    throw new TemplateValidationError("Starter template was not found");
  }

  await dedupeUnusedStarterTemplates(organizationId);

  const existing = await findExistingStarterTemplate(organizationId, starter);
  if (existing) {
    return { template: existing, created: false as const };
  }

  const template = await createTemplate(organizationId, {
    name: starter.name,
    occasionId: starter.occasionId,
    channel: starter.channel,
    body: starter.body,
    isActive: true,
    replaceExisting: false,
  });

  return { template, created: true as const };
}

export async function listTemplates(
  organizationId: string,
  query: ListTemplatesQuery,
) {
  await dedupeUnusedDuplicateTemplates(organizationId);

  const where = buildTemplateListWhere(organizationId, query);

  const [total, templates] = await prisma.$transaction([
    prisma.messageTemplate.count({ where }),
    prisma.messageTemplate.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        occasion: { select: { id: true, name: true } },
        whatsappMediaAsset: { select: { contentType: true } },
        documentTemplate: { select: { id: true, name: true } },
      },
      orderBy: [
        { channel: "asc" },
        { occasion: { name: "asc" } },
        { name: "asc" },
        { id: "asc" },
      ],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    data: templates.map(serializeTemplate),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getTemplate(
  organizationId: string,
  templateId: string,
) {
  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, organizationId },
    include: {
        category: { select: { id: true, name: true } },
        occasion: { select: { id: true, name: true } },
        whatsappMediaAsset: { select: { contentType: true } },
        documentTemplate: { select: { id: true, name: true } },
      },
  });

  if (!template) {
    throw new TemplateNotFoundError();
  }

  return template;
}

export async function updateTemplate(
  organizationId: string,
  templateId: string,
  input: UpdateTemplateInput,
) {
  const existing = await getTemplate(organizationId, templateId);
  const allowedVariables = await allowedTemplateVariablesForOrganization(organizationId);
  const mapped = mapTemplateInput(input, { allowedVariables });
  const nextChannel = mapped.channel ?? existing.channel;
  const nextName = mapped.name ?? existing.name;
  const nextBody = mapped.body ?? existing.body;
  const nextCategoryId =
    input.categoryId !== undefined
      ? await assertCategoryForOrganization(organizationId, input.categoryId)
      : existing.categoryId;
  const nextOccasionId =
    input.occasionId !== undefined
      ? await assertOccasionForOrganization(organizationId, input.occasionId)
      : existing.occasionId;
  const bodyVariables = validateTemplateVariables(nextBody, allowedVariables);

  await assertUniqueTemplateName(
    organizationId,
    nextName,
    nextChannel,
    nextCategoryId,
    templateId,
  );

  if (mapped.whatsappMediaAssetId) {
    await assertTemplateMedia(
      organizationId,
      mapped.whatsappMediaAssetId,
    );
  }

  const nextIncludePersonalizedPdf =
    mapped.includePersonalizedPdf ?? existing.includePersonalizedPdf;
  const nextDocumentTemplateId =
    input.documentTemplateId !== undefined
      ? input.documentTemplateId
      : existing.documentTemplateId;

  if (input.documentTemplateId !== undefined && input.documentTemplateId !== null) {
    await assertDocumentTemplateForOrganization(
      organizationId,
      input.documentTemplateId,
    );
  }

  if (nextIncludePersonalizedPdf && !nextDocumentTemplateId) {
    throw new TemplateValidationError(
      "Select a document template to include a personalized PDF",
    );
  }

  if (nextChannel === Channel.SMS) {
    if (
      input.whatsappTemplateName !== undefined ||
      input.whatsappProviderTemplateId !== undefined ||
      input.whatsappLanguage !== undefined ||
      input.whatsappParameterOrder !== undefined
    ) {
      throw new TemplateValidationError(
        "SMS templates cannot include WhatsApp metadata",
      );
    }
  }

  let whatsappTemplateName = existing.whatsappTemplateName;
  let whatsappProviderTemplateId = existing.whatsappProviderTemplateId;
  let whatsappLanguage = existing.whatsappLanguage;
  let whatsappParameterOrder = existing.whatsappParameterOrder;

  if (nextChannel === Channel.WHATSAPP) {
    whatsappTemplateName =
      mapped.whatsappTemplateName !== undefined
        ? mapped.whatsappTemplateName
        : existing.whatsappTemplateName;
    whatsappProviderTemplateId =
      mapped.whatsappProviderTemplateId !== undefined
        ? mapped.whatsappProviderTemplateId
        : existing.whatsappProviderTemplateId;
    whatsappLanguage =
      mapped.whatsappLanguage !== undefined
        ? mapped.whatsappLanguage
        : existing.whatsappLanguage;

    if (!whatsappTemplateName?.trim()) {
      throw new TemplateValidationError(
        "WhatsApp provider template name is required",
      );
    }

    if (!whatsappLanguage?.trim()) {
      throw new TemplateValidationError("WhatsApp language is required");
    }

    try {
      whatsappParameterOrder = normalizeWhatsAppParameterOrder(
        mapped.whatsappParameterOrder ?? existing.whatsappParameterOrder,
        bodyVariables,
      );
    } catch (error) {
      throw new TemplateValidationError(
        error instanceof Error ? error.message : "Invalid WhatsApp metadata",
      );
    }
  } else {
    whatsappTemplateName = null;
    whatsappProviderTemplateId = null;
    whatsappLanguage = null;
    whatsappParameterOrder = [];
  }

  try {
    return await prisma.messageTemplate.update({
      where: { id: templateId },
      data: {
        ...(mapped.name !== undefined ? { name: mapped.name } : {}),
        ...(input.occasionId !== undefined
          ? { occasionId: nextOccasionId }
          : {}),
        channel: nextChannel,
        ...(input.categoryId !== undefined
          ? { categoryId: nextCategoryId }
          : {}),
        ...(mapped.body !== undefined
          ? {
              body: mapped.body,
              variables: bodyVariables,
            }
          : mapped.channel !== undefined ||
              mapped.whatsappParameterOrder !== undefined
            ? { variables: bodyVariables }
            : {}),
        ...(mapped.isActive !== undefined ? { isActive: mapped.isActive } : {}),
        ...(mapped.emailSubject !== undefined
          ? {
              emailSubject:
                nextChannel === Channel.EMAIL ? mapped.emailSubject : null,
            }
          : nextChannel !== Channel.EMAIL
            ? { emailSubject: null }
            : {}),
        whatsappTemplateName,
        whatsappProviderTemplateId,
        whatsappLanguage,
        whatsappParameterOrder,
        ...(nextChannel !== Channel.WHATSAPP
          ? { whatsappMediaAssetId: null }
          : mapped.whatsappMediaAssetId !== undefined
            ? { whatsappMediaAssetId: mapped.whatsappMediaAssetId }
            : {}),
        ...(nextChannel === Channel.WHATSAPP
          ? {
              dltTemplateId: null,
              dltApprovedContent: null,
            }
          : {}),
        ...(nextChannel === Channel.EMAIL
          ? {
              dltTemplateId: null,
              dltApprovedContent: null,
              whatsappTemplateName: null,
              whatsappProviderTemplateId: null,
              whatsappLanguage: null,
              whatsappParameterOrder: [],
            }
          : {}),
        includePersonalizedPdf: nextIncludePersonalizedPdf,
        documentTemplateId: nextIncludePersonalizedPdf ? nextDocumentTemplateId : null,
      },
      include: {
        category: { select: { id: true, name: true } },
        occasion: { select: { id: true, name: true } },
        whatsappMediaAsset: { select: { contentType: true } },
        documentTemplate: { select: { id: true, name: true } },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new TemplateNotFoundError();
    }

    throw error;
  }
}

export async function deactivateTemplate(
  organizationId: string,
  templateId: string,
) {
  return updateTemplate(organizationId, templateId, { isActive: false });
}

export async function deleteTemplate(
  organizationId: string,
  templateId: string,
) {
  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: {
      id: true,
      _count: { select: { sendQueues: true } },
    },
  });

  if (!template) {
    throw new TemplateNotFoundError();
  }

  if (template._count.sendQueues > 0) {
    throw new TemplateInUseError();
  }

  try {
    await prisma.messageTemplate.delete({ where: { id: template.id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new TemplateNotFoundError();
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      throw new TemplateInUseError();
    }

    throw error;
  }
}

export { serializeTemplate };
