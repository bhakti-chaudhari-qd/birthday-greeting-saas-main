import { z } from "zod";

const documentTemplateNameSchema = z.string().trim().min(1).max(100);
const occasionIdSchema = z.string().trim().min(1).max(100);

export const createDocumentTemplateMetadataSchema = z.object({
  name: documentTemplateNameSchema,
  occasionId: occasionIdSchema.optional(),
});

export const BLANK_PAGE_SIZES = ["A4", "LETTER"] as const;
export const BLANK_PAGE_ORIENTATIONS = ["portrait", "landscape"] as const;

export const createBlankDocumentTemplateSchema = z
  .object({
    name: documentTemplateNameSchema,
    occasionId: occasionIdSchema.optional(),
    pageSize: z.enum(BLANK_PAGE_SIZES).default("A4"),
    orientation: z.enum(BLANK_PAGE_ORIENTATIONS).default("portrait"),
  })
  .strict();

export const updateDocumentTemplateSchema = z
  .object({
    name: documentTemplateNameSchema.optional(),
    occasionId: occasionIdSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const listDocumentTemplatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  occasionId: occasionIdSchema.optional(),
  isActive: z.enum(["true", "false", "all"]).optional().default("all"),
});

export type CreateDocumentTemplateMetadataInput = z.infer<
  typeof createDocumentTemplateMetadataSchema
>;
export type CreateBlankDocumentTemplateInput = z.infer<
  typeof createBlankDocumentTemplateSchema
>;
export type UpdateDocumentTemplateInput = z.infer<
  typeof updateDocumentTemplateSchema
>;
export type ListDocumentTemplatesQuery = z.infer<
  typeof listDocumentTemplatesQuerySchema
>;
