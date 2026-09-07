import { z } from "zod";

const dltTemplateIdSchema = z
  .string()
  .trim()
  .min(1, "DLT Template ID is required")
  .max(100)
  .regex(/^[\w-]+$/, "DLT Template ID contains invalid characters");
const dltApprovedContentSchema = z.string().trim().min(1).max(1000);

export const updateTemplateSmsSetupSchema = z
  .object({
    dltTemplateId: dltTemplateIdSchema,
    dltApprovedContent: dltApprovedContentSchema,
    confirmDltPairReviewed: z.boolean().optional(),
  })
  .strict();

export type UpdateTemplateSmsSetupInput = z.infer<
  typeof updateTemplateSmsSetupSchema
>;

export const createTemplateFromStarterSchema = z
  .object({
    starterId: z.string().trim().min(1).max(100),
  })
  .strict();

export type CreateTemplateFromStarterInput = z.infer<
  typeof createTemplateFromStarterSchema
>;
