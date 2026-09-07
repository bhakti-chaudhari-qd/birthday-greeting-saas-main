import { z } from "zod";

import { variableDataSchema } from "./document-template-generate";

export const createGeneratedDocumentSchema = z
  .object({
    templateId: z.string().trim().min(1).max(100),
    data: variableDataSchema,
  })
  .strict();

export const listGeneratedDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateGeneratedDocumentInput = z.infer<
  typeof createGeneratedDocumentSchema
>;
export type ListGeneratedDocumentsQuery = z.infer<
  typeof listGeneratedDocumentsQuerySchema
>;
