import { z } from "zod";

export const automationSendTimeFieldsSchema = {
  automationSendHour: z.number().int().min(0).max(23).nullable().optional(),
  automationSendMinute: z.number().int().min(0).max(59).nullable().optional(),
};

export const updateBirthdayAutomationSettingsSchema = z
  .object({
    autoSendEnabled: z.boolean().optional(),
    birthdayTemplateId: z.string().trim().min(1).nullable().optional(),
    whatsappAutoSendEnabled: z.boolean().optional(),
    whatsappBirthdayTemplateId: z.string().trim().min(1).nullable().optional(),
    ...automationSendTimeFieldsSchema,
  })
  .strict();

export type UpdateBirthdayAutomationSettingsInput = z.infer<
  typeof updateBirthdayAutomationSettingsSchema
>;
