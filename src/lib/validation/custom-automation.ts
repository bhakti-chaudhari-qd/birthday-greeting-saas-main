import { z } from "zod";

import { automationSendTimeFieldsSchema } from "@/lib/validation/birthday-automation";

export const updateCustomAutomationSettingsSchema = z
  .object({
    customAutoSendEnabled: z.boolean().optional(),
    customTemplateId: z.string().trim().min(1).nullable().optional(),
    whatsappCustomAutoSendEnabled: z.boolean().optional(),
    whatsappCustomTemplateId: z.string().trim().min(1).nullable().optional(),
    ...automationSendTimeFieldsSchema,
  })
  .strict();

export type UpdateCustomAutomationSettingsInput = z.infer<
  typeof updateCustomAutomationSettingsSchema
>;
