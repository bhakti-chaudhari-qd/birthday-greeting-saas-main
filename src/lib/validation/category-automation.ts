import { z } from "zod";

const hourSchema = z.number().int().min(0).max(23);
const minuteSchema = z.number().int().min(0).max(59);

const ruleFieldsSchema = z.object({
  sendHour: hourSchema.nullable(),
  sendMinute: minuteSchema.nullable(),
  smsEnabled: z.boolean(),
  smsTemplateId: z.string().trim().min(1).nullable(),
  whatsappEnabled: z.boolean(),
  whatsappTemplateId: z.string().trim().min(1).nullable(),
  emailEnabled: z.boolean().optional().default(false),
  emailTemplateId: z.string().trim().min(1).nullable().optional(),
  callEnabled: z.boolean().optional().default(false),
  /** Accepted for backward compatibility; always coerced to false. */
  aiAssistEnabled: z.boolean().optional().default(false),
});

function refineRuleFields(
  value: z.infer<typeof ruleFieldsSchema>,
  ctx: z.RefinementCtx,
) {
  const anyChannelEnabled =
    value.smsEnabled ||
    value.whatsappEnabled ||
    Boolean(value.emailEnabled) ||
    Boolean(value.callEnabled);
  const timeSet = value.sendHour !== null && value.sendMinute !== null;

  if (anyChannelEnabled && !timeSet) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Set a send time before enabling automatic channels",
      path: ["sendHour"],
    });
  }
  if ((value.sendHour === null) !== (value.sendMinute === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Send hour and minute must both be set or both cleared",
      path: ["sendMinute"],
    });
  }
  if (value.smsEnabled && !value.smsTemplateId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "SMS template is required when SMS is enabled",
      path: ["smsTemplateId"],
    });
  }
  if (value.whatsappEnabled && !value.whatsappTemplateId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "WhatsApp template is required when WhatsApp is enabled",
      path: ["whatsappTemplateId"],
    });
  }
  if (value.emailEnabled && !value.emailTemplateId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Email template is required when Email is enabled",
      path: ["emailTemplateId"],
    });
  }
}

export const categoryAutomationRuleInputSchema = ruleFieldsSchema
  .extend({ categoryId: z.string().trim().min(1) })
  .transform((value) => ({ ...value, aiAssistEnabled: false }))
  .superRefine(refineRuleFields);

/** Same shape as a category rule, without categoryId - the "all contacts" row. */
export const allContactsAutomationRuleInputSchema = ruleFieldsSchema
  .transform((value) => ({ ...value, aiAssistEnabled: false }))
  .superRefine(refineRuleFields);

export const categoryAutomationOccasionInputSchema = z.object({
  occasionId: z.string().trim().min(1),
  rules: z.array(categoryAutomationRuleInputSchema).max(200),
  /** The categoryId=null row: applies to contacts with no matching category-specific rule. */
  allContactsRule: allContactsAutomationRuleInputSchema.nullable().optional(),
});

/**
 * Accepts either a single occasion (`occasionId` + `rules`) or
 * `{ occasions: [...] }` to save every occasion together.
 */
export const updateCategoryAutomationRulesSchema = z
  .union([
    categoryAutomationOccasionInputSchema,
    z.object({
      occasions: z
        .array(categoryAutomationOccasionInputSchema)
        .min(1)
        .max(50),
    }),
  ])
  .transform((value) => {
    if ("occasions" in value) {
      return { occasions: value.occasions };
    }
    return { occasions: [value] };
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const [index, occasion] of value.occasions.entries()) {
      if (seen.has(occasion.occasionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate occasionId in occasions payload",
          path: ["occasions", index, "occasionId"],
        });
      }
      seen.add(occasion.occasionId);
    }
  });

export type CategoryAutomationRuleInput = z.infer<
  typeof categoryAutomationRuleInputSchema
>;
export type AllContactsAutomationRuleInput = z.infer<
  typeof allContactsAutomationRuleInputSchema
>;
export type CategoryAutomationOccasionInput = z.infer<
  typeof categoryAutomationOccasionInputSchema
>;
export type UpdateCategoryAutomationRulesInput = z.infer<
  typeof updateCategoryAutomationRulesSchema
>;
