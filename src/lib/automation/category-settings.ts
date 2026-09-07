import { Channel, type MessageTemplate } from "@prisma/client";

import {
  formatAutomationSendTimeLabel,
} from "@/lib/automation/send-time";
import { prisma } from "@/lib/db";
import {
  ensureDefaultContactCategories,
  listContactCategories,
} from "@/lib/contacts/categories";
import type {
  AllContactsAutomationRuleInput,
  CategoryAutomationRuleInput,
  UpdateCategoryAutomationRulesInput,
} from "@/lib/validation/category-automation";

export class CategoryAutomationSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryAutomationSettingsError";
  }
}

export type CategoryAutomationRuleView = {
  id: string | null;
  categoryId: string;
  categoryName: string;
  contactCount: number;
  sendHour: number | null;
  sendMinute: number | null;
  sendTimeLabel: string;
  smsEnabled: boolean;
  smsTemplateId: string | null;
  whatsappEnabled: boolean;
  whatsappTemplateId: string | null;
  emailEnabled: boolean;
  emailTemplateId: string | null;
  callEnabled: boolean;
  aiAssistEnabled: boolean;
};

/** The categoryId=null row: applies to contacts with no matching category-specific rule. */
export type AllContactsAutomationRuleView = Omit<
  CategoryAutomationRuleView,
  "categoryId" | "categoryName" | "contactCount"
>;

export type CategoryAutomationSettingsView = {
  occasionId: string;
  allContactsRule: AllContactsAutomationRuleView;
  rules: CategoryAutomationRuleView[];
  eligibleSmsTemplates: Array<{
    id: string;
    name: string;
    categoryId: string | null;
    categoryName: string | null;
    realSmsReady: boolean;
    realSmsStatusLabel: string;
  }>;
  eligibleWhatsAppTemplates: Array<{
    id: string;
    name: string;
    categoryId: string | null;
    categoryName: string | null;
    readinessLabel: string;
  }>;
  eligibleEmailTemplates: Array<{
    id: string;
    name: string;
    categoryId: string | null;
    categoryName: string | null;
    subject: string | null;
  }>;
};

function smsReadiness(template: {
  dltTemplateId: string | null;
  dltApprovedContent: string | null;
}) {
  const ready = Boolean(
    template.dltTemplateId?.trim() && template.dltApprovedContent?.trim(),
  );
  return {
    realSmsReady: ready,
    realSmsStatusLabel: ready ? "DLT ready" : "Needs DLT fields",
  };
}

function whatsappReadiness(template: {
  whatsappTemplateName: string | null;
  whatsappLanguage: string | null;
}) {
  const ready = Boolean(
    template.whatsappTemplateName?.trim() && template.whatsappLanguage?.trim(),
  );
  return {
    readinessLabel: ready ? "Ready" : "Needs WhatsApp name/language",
  };
}

async function loadEligibleTemplates(organizationId: string, occasionId: string) {
  const templates = await prisma.messageTemplate.findMany({
    where: { organizationId, occasionId, isActive: true },
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return {
    sms: templates
      .filter((template) => template.channel === Channel.SMS)
      .map((template) => ({
        id: template.id,
        name: template.name,
        categoryId: template.categoryId,
        categoryName: template.category?.name ?? null,
        ...smsReadiness(template),
      })),
    whatsapp: templates
      .filter((template) => template.channel === Channel.WHATSAPP)
      .map((template) => ({
        id: template.id,
        name: template.name,
        categoryId: template.categoryId,
        categoryName: template.category?.name ?? null,
        ...whatsappReadiness(template),
      })),
    email: templates
      .filter((template) => template.channel === Channel.EMAIL)
      .map((template) => ({
        id: template.id,
        name: template.name,
        categoryId: template.categoryId,
        categoryName: template.category?.name ?? null,
        subject: template.emailSubject,
      })),
  };
}

/** Shared by both automation-generation validation and settings-save validation. */
export async function assertTemplateForRule(
  organizationId: string,
  templateId: string,
  channel: Channel,
  occasionId: string,
  ruleCategoryId?: string | null,
): Promise<MessageTemplate> {
  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, organizationId },
  });

  if (!template || !template.isActive) {
    throw new CategoryAutomationSettingsError(
      channel === Channel.WHATSAPP
        ? "Selected WhatsApp template was not found or is inactive"
        : channel === Channel.EMAIL
          ? "Selected Email template was not found or is inactive"
          : "Selected SMS template was not found or is inactive",
    );
  }

  if (template.channel !== channel) {
    throw new CategoryAutomationSettingsError(
      `Template channel must be ${channel}`,
    );
  }

  if (template.occasionId !== occasionId) {
    throw new CategoryAutomationSettingsError(
      "Template occasion must match this automation's occasion",
    );
  }

  if (
    ruleCategoryId &&
    template.categoryId &&
    template.categoryId !== ruleCategoryId
  ) {
    throw new CategoryAutomationSettingsError(
      "Selected message is for a different contact group",
    );
  }

  if (
    channel === Channel.WHATSAPP &&
    (!template.whatsappTemplateName?.trim() ||
      !template.whatsappLanguage?.trim())
  ) {
    throw new CategoryAutomationSettingsError(
      "WhatsApp template name and language are required",
    );
  }

  if (channel === Channel.EMAIL && !template.emailSubject?.trim()) {
    throw new CategoryAutomationSettingsError("Email subject is required");
  }

  return template;
}

/** Validate an EMAIL template for automation / queue generation. */
export async function validateEmailOccasionTemplate(
  organizationId: string,
  templateId: string,
  occasionId: string,
): Promise<MessageTemplate> {
  return assertTemplateForRule(organizationId, templateId, Channel.EMAIL, occasionId);
}

function ruleToView(
  rule: {
    id: string;
    sendHour: number | null;
    sendMinute: number | null;
    smsEnabled: boolean;
    smsTemplateId: string | null;
    whatsappEnabled: boolean;
    whatsappTemplateId: string | null;
    emailEnabled: boolean;
    emailTemplateId: string | null;
    callEnabled: boolean;
    aiAssistEnabled: boolean;
  } | undefined,
): AllContactsAutomationRuleView {
  const sendHour = rule?.sendHour ?? null;
  const sendMinute = rule?.sendMinute ?? null;

  return {
    id: rule?.id ?? null,
    sendHour,
    sendMinute,
    sendTimeLabel: formatAutomationSendTimeLabel(sendHour, sendMinute),
    smsEnabled: rule?.smsEnabled ?? false,
    smsTemplateId: rule?.smsTemplateId ?? null,
    whatsappEnabled: rule?.whatsappEnabled ?? false,
    whatsappTemplateId: rule?.whatsappTemplateId ?? null,
    emailEnabled: rule?.emailEnabled ?? false,
    emailTemplateId: rule?.emailTemplateId ?? null,
    callEnabled: rule?.callEnabled ?? false,
    aiAssistEnabled: rule?.aiAssistEnabled ?? false,
  };
}

export async function getCategoryAutomationSettings(
  organizationId: string,
  occasionId: string,
): Promise<CategoryAutomationSettingsView> {
  await ensureDefaultContactCategories(organizationId);

  const [categories, savedRules, eligible] = await Promise.all([
    listContactCategories(organizationId),
    prisma.categoryAutomationRule.findMany({
      where: { organizationId, occasionId },
    }),
    loadEligibleTemplates(organizationId, occasionId),
  ]);

  const byCategory = new Map(
    savedRules
      .filter((rule) => rule.categoryId !== null)
      .map((rule) => [rule.categoryId as string, rule] as const),
  );
  const allContactsSaved = savedRules.find((rule) => rule.categoryId === null);

  const rules: CategoryAutomationRuleView[] = categories.map((category) => {
    const saved = byCategory.get(category.id);
    const view = ruleToView(saved);

    return {
      ...view,
      categoryId: category.id,
      categoryName: category.name,
      contactCount: category.contactCount ?? 0,
    };
  });

  return {
    occasionId,
    allContactsRule: ruleToView(allContactsSaved),
    rules,
    eligibleSmsTemplates: eligible.sms,
    eligibleWhatsAppTemplates: eligible.whatsapp,
    eligibleEmailTemplates: eligible.email,
  };
}

export async function updateCategoryAutomationRules(
  organizationId: string,
  input:
    | UpdateCategoryAutomationRulesInput
    | {
        occasionId: string;
        rules: CategoryAutomationRuleInput[];
        allContactsRule?: AllContactsAutomationRuleInput | null;
      },
): Promise<CategoryAutomationSettingsView[]> {
  const occasions = "occasions" in input ? input.occasions : [input];
  const categories = await listContactCategories(organizationId);
  const categoryIds = new Set(categories.map((category) => category.id));

  async function assertRule(
    rule: CategoryAutomationRuleInput | AllContactsAutomationRuleInput,
    occasionId: string,
    ruleCategoryId: string | null,
  ) {
    if (rule.smsTemplateId) {
      await assertTemplateForRule(
        organizationId,
        rule.smsTemplateId,
        Channel.SMS,
        occasionId,
        ruleCategoryId,
      );
    }
    if (rule.whatsappTemplateId) {
      await assertTemplateForRule(
        organizationId,
        rule.whatsappTemplateId,
        Channel.WHATSAPP,
        occasionId,
        ruleCategoryId,
      );
    }
    if (rule.emailTemplateId) {
      await assertTemplateForRule(
        organizationId,
        rule.emailTemplateId,
        Channel.EMAIL,
        occasionId,
        ruleCategoryId,
      );
    }
  }

  for (const occasion of occasions) {
    const { occasionId, rules, allContactsRule } = occasion;
    const seen = new Set<string>();

    for (const rule of rules) {
      if (!categoryIds.has(rule.categoryId)) {
        throw new CategoryAutomationSettingsError(
          "One or more categories were not found",
        );
      }
      if (seen.has(rule.categoryId)) {
        throw new CategoryAutomationSettingsError(
          "Duplicate category rows are not allowed",
        );
      }
      seen.add(rule.categoryId);

      await assertRule(rule, occasionId, rule.categoryId);
    }

    if (allContactsRule) {
      await assertRule(allContactsRule, occasionId, null);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const occasion of occasions) {
      const { occasionId, rules, allContactsRule } = occasion;

      await tx.categoryAutomationRule.deleteMany({
        where: { organizationId, occasionId },
      });

      const rows: Array<CategoryAutomationRuleInput | AllContactsAutomationRuleInput> =
        [...rules];
      const categoryIdByIndex: Array<string | null> = rules.map(
        (rule) => rule.categoryId,
      );
      if (allContactsRule) {
        rows.push(allContactsRule);
        categoryIdByIndex.push(null);
      }

      if (rows.length === 0) {
        continue;
      }

      await tx.categoryAutomationRule.createMany({
        data: rows.map((rule, index) => ({
          organizationId,
          occasionId,
          categoryId: categoryIdByIndex[index] ?? null,
          sendHour: rule.sendHour,
          sendMinute: rule.sendMinute,
          smsEnabled: rule.smsEnabled,
          smsTemplateId: rule.smsTemplateId,
          whatsappEnabled: rule.whatsappEnabled,
          whatsappTemplateId: rule.whatsappTemplateId,
          emailEnabled: rule.emailEnabled ?? false,
          emailTemplateId: rule.emailTemplateId ?? null,
          callEnabled: rule.callEnabled ?? false,
          // AI assist is not a product feature yet - never persist client values.
          aiAssistEnabled: false,
        })),
      });
    }
  });

  return Promise.all(
    occasions.map((occasion) =>
      getCategoryAutomationSettings(organizationId, occasion.occasionId),
    ),
  );
}

export type ActiveCategoryChannelRule = {
  categoryId: string | null;
  sendHour: number;
  sendMinute: number;
  templateId: string;
};

/**
 * Active channel rules for an occasion (category-specific rows plus the
 * categoryId=null "all contacts" row, if configured) - used by automation
 * generation.
 */
export async function listActiveCategoryChannelRules(
  organizationId: string,
  occasionId: string,
  channel: Channel,
): Promise<ActiveCategoryChannelRule[]> {
  const whereChannel =
    channel === Channel.WHATSAPP
      ? { whatsappEnabled: true, whatsappTemplateId: { not: null } as const }
      : channel === Channel.EMAIL
        ? { emailEnabled: true, emailTemplateId: { not: null } as const }
        : { smsEnabled: true, smsTemplateId: { not: null } as const };

  const rules = await prisma.categoryAutomationRule.findMany({
    where: {
      organizationId,
      occasionId,
      sendHour: { not: null },
      sendMinute: { not: null },
      ...whereChannel,
    },
  });

  return rules
    .filter(
      (rule): rule is typeof rule & { sendHour: number; sendMinute: number } =>
        rule.sendHour !== null && rule.sendMinute !== null,
    )
    .map((rule) => ({
      categoryId: rule.categoryId,
      sendHour: rule.sendHour,
      sendMinute: rule.sendMinute,
      templateId:
        channel === Channel.WHATSAPP
          ? rule.whatsappTemplateId!
          : channel === Channel.EMAIL
            ? rule.emailTemplateId!
            : rule.smsTemplateId!,
    }));
}

export async function organizationHasActiveCategoryRules(
  organizationId: string,
  occasionId: string,
): Promise<boolean> {
  const count = await prisma.categoryAutomationRule.count({
    where: {
      organizationId,
      occasionId,
      OR: [
        { smsEnabled: true, smsTemplateId: { not: null } },
        { whatsappEnabled: true, whatsappTemplateId: { not: null } },
        { emailEnabled: true, emailTemplateId: { not: null } },
      ],
    },
  });
  return count > 0;
}

/**
 * Suggest SMS/WhatsApp templates for manual send from a contact's category rule.
 */
export async function resolveManualSendDefaultsForContacts(
  organizationId: string,
  occasionId: string,
  contactIds: string[],
): Promise<{
  smsTemplateId: string | null;
  whatsappTemplateId: string | null;
  emailTemplateId: string | null;
  categoryId: string | null;
  categoryName: string | null;
}> {
  if (contactIds.length === 0) {
    return {
      smsTemplateId: null,
      whatsappTemplateId: null,
      emailTemplateId: null,
      categoryId: null,
      categoryName: null,
    };
  }

  const contacts = await prisma.contact.findMany({
    where: { organizationId, id: { in: contactIds } },
    select: {
      categoryId: true,
      category: { select: { name: true } },
    },
  });

  const categoryIds = [
    ...new Set(
      contacts
        .map((contact) => contact.categoryId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (categoryIds.length !== 1) {
    return {
      smsTemplateId: null,
      whatsappTemplateId: null,
      emailTemplateId: null,
      categoryId: null,
      categoryName: null,
    };
  }

  const categoryId = categoryIds[0]!;
  const rule = await prisma.categoryAutomationRule.findFirst({
    where: { organizationId, occasionId, categoryId },
  });

  const contact = contacts.find((item) => item.categoryId === categoryId);

  return {
    smsTemplateId: rule?.smsEnabled ? rule.smsTemplateId : null,
    whatsappTemplateId: rule?.whatsappEnabled
      ? rule.whatsappTemplateId
      : null,
    emailTemplateId: rule?.emailEnabled ? rule.emailTemplateId : null,
    categoryId,
    categoryName: contact?.category?.name ?? null,
  };
}
