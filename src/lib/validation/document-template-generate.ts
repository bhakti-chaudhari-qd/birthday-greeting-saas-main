import { z } from "zod";

/** Same simple-name rule as the {{variable}} syntax itself. */
const VARIABLE_DATA_KEY_PATTERN = /^\w+$/;

/** Reused wherever a caller supplies {{variable}} values (Phase 4 generate, Phase 5 generate-and-store). */
export const variableDataSchema = z
  .record(z.string().regex(VARIABLE_DATA_KEY_PATTERN).max(100), z.string().max(500))
  .default({});

export const generateDocumentTemplateSchema = z
  .object({
    data: variableDataSchema,
  })
  .strict();

export type GenerateDocumentTemplateInput = z.infer<
  typeof generateDocumentTemplateSchema
>;
