import { Channel } from "@prisma/client";

export type StarterTemplateDraft = {
  id: string;
  name: string;
  description: string;
  occasionId: string;
  channel: typeof Channel.SMS;
  body: string;
};

/**
 * Product starter drafts shown on the Templates page.
 * Empty by product decision - users create templates manually.
 */
export const STARTER_TEMPLATE_CATALOG: readonly StarterTemplateDraft[] = [];

export function listStarterTemplateDrafts(): StarterTemplateDraft[] {
  return STARTER_TEMPLATE_CATALOG.map((starter) => ({ ...starter }));
}

export function getStarterTemplateDraft(
  starterId: string,
): StarterTemplateDraft | null {
  const starter = STARTER_TEMPLATE_CATALOG.find((item) => item.id === starterId);
  return starter ? { ...starter } : null;
}

export function serializeStarterTemplateDraft(
  starter: StarterTemplateDraft,
  options: { existingTemplateId?: string | null } = {},
) {
  return {
    id: starter.id,
    name: starter.name,
    description: starter.description,
    occasionId: starter.occasionId,
    channel: starter.channel,
    body: starter.body,
    isStarterDraft: true as const,
    dltConfigured: false as const,
    realSmsReady: false as const,
    realSmsStatusLabel: "Available for Test" as const,
    existingTemplateId: options.existingTemplateId ?? null,
  };
}
