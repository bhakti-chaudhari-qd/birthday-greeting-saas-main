import { Channel } from "@prisma/client";
import { z } from "zod";

import {
  whatsappLanguageSchema,
  whatsappParameterOrderSchema,
  whatsappProviderTemplateIdSchema,
  whatsappTemplateNameSchema,
} from "@/lib/templates/whatsapp-metadata";

const templateBodySchema = z.string().trim().min(1).max(5000);
const emailSubjectSchema = z.string().trim().min(1).max(200);
const occasionIdSchema = z.string().trim().min(1).max(100);

export const createTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    occasionId: occasionIdSchema,
    channel: z.nativeEnum(Channel),
    body: templateBodySchema,
    emailSubject: emailSubjectSchema.optional(),
    /** Contact group this message is for. Null/omit = All groups. */
    categoryId: z.string().cuid().nullable().optional(),
    isActive: z.boolean().optional().default(true),
    whatsappTemplateName: whatsappTemplateNameSchema.optional(),
    whatsappProviderTemplateId: whatsappProviderTemplateIdSchema.optional(),
    whatsappLanguage: whatsappLanguageSchema.optional(),
    whatsappParameterOrder: whatsappParameterOrderSchema.optional(),
    whatsappMediaAssetId: z.string().cuid().optional(),
    /** Phase 6 step 1: optional personalized PDF attachment configuration only - no generation here. */
    includePersonalizedPdf: z.boolean().optional().default(false),
    documentTemplateId: z.string().cuid().nullable().optional(),
    /** When true, update the existing same-name+channel+category message instead of failing. */
    replaceExisting: z.boolean().optional().default(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.includePersonalizedPdf && !value.documentTemplateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a document template to include a personalized PDF",
        path: ["documentTemplateId"],
      });
    }

    if (value.channel === Channel.EMAIL) {
      if (!value.emailSubject) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Email subject is required",
          path: ["emailSubject"],
        });
      }
      if (value.whatsappTemplateName !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Email templates cannot include WhatsApp template name",
          path: ["whatsappTemplateName"],
        });
      }
    }

    if (value.channel === Channel.WHATSAPP) {
      if (!value.whatsappTemplateName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "WhatsApp provider template name is required",
          path: ["whatsappTemplateName"],
        });
      }

      if (!value.whatsappLanguage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "WhatsApp language is required",
          path: ["whatsappLanguage"],
        });
      }
    }

    if (value.channel === Channel.SMS || value.channel === Channel.EMAIL) {
      if (value.whatsappMediaAssetId !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Only WhatsApp messages can include media",
          path: ["whatsappMediaAssetId"],
        });
      }
      if (
        value.channel === Channel.SMS &&
        value.whatsappTemplateName !== undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SMS templates cannot include WhatsApp template name",
          path: ["whatsappTemplateName"],
        });
      }

      if (
        value.channel === Channel.SMS &&
        value.whatsappProviderTemplateId !== undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SMS templates cannot include WhatsApp template ID",
          path: ["whatsappProviderTemplateId"],
        });
      }

      if (value.whatsappLanguage !== undefined && value.channel === Channel.SMS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SMS templates cannot include WhatsApp language",
          path: ["whatsappLanguage"],
        });
      }

      if (
        value.whatsappParameterOrder !== undefined &&
        value.channel === Channel.SMS
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "SMS templates cannot include WhatsApp parameter order",
          path: ["whatsappParameterOrder"],
        });
      }
    }

    if (value.channel !== Channel.EMAIL && value.emailSubject !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only email templates can include a subject",
        path: ["emailSubject"],
      });
    }
  });

export const updateTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    occasionId: occasionIdSchema.optional(),
    channel: z.nativeEnum(Channel).optional(),
    body: templateBodySchema.optional(),
    emailSubject: emailSubjectSchema.nullable().optional(),
    categoryId: z.string().cuid().nullable().optional(),
    isActive: z.boolean().optional(),
    whatsappTemplateName: whatsappTemplateNameSchema.optional(),
    whatsappProviderTemplateId: whatsappProviderTemplateIdSchema.nullable().optional(),
    whatsappLanguage: whatsappLanguageSchema.optional(),
    whatsappParameterOrder: whatsappParameterOrderSchema.optional(),
    whatsappMediaAssetId: z.string().cuid().nullable().optional(),
    /** Phase 6 step 1: optional personalized PDF attachment configuration only - no generation here. */
    includePersonalizedPdf: z.boolean().optional(),
    documentTemplateId: z.string().cuid().nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    // Full "enabled but nothing selected" validation (accounting for the
    // existing saved value on partial updates) happens in the service -
    // this only catches the unambiguous case where a single request both
    // enables the flag and explicitly clears the selection.
    if (value.includePersonalizedPdf === true && value.documentTemplateId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a document template to include a personalized PDF",
        path: ["documentTemplateId"],
      });
    }
  });

export const listTemplatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  occasionId: occasionIdSchema.optional(),
  channel: z.nativeEnum(Channel).optional(),
  /** Filter by group. Use "all" for All-groups templates only (categoryId null). */
  categoryId: z.union([z.literal("all"), z.string().cuid()]).optional(),
  isActive: z
    .enum(["true", "false", "all"])
    .optional()
    .default("all"),
});

export type CreateTemplateInput = z.input<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;
