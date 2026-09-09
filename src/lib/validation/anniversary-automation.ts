import { z } from "zod";

import { automationSendTimeFieldsSchema } from "@/lib/validation/birthday-automation";

export const updateAnniversaryAutomationSettingsSchema = z
  .object({
    anniversaryAutoSendEnabled: z.boolean().optional(),
    anniversaryTemplateId: z.string().trim().min(1).nullable().optional(),
    whatsappAnniversaryAutoSendEnabled: z.boolean().optional(),
    whatsappAnniversaryTemplateId: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .optional(),
    ...automationSendTimeFieldsSchema,
  })
  .strict();

export type UpdateAnniversaryAutomationSettingsInput = z.infer<
  typeof updateAnniversaryAutomationSettingsSchema
>;
