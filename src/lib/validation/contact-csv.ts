import { z } from "zod";

const importFieldMappingSchema = z
  .object({
    header: z.string().trim().min(1).max(120),
    action: z.enum(["ignore", "existing", "create"]),
    fieldKey: z.string().trim().min(1).max(80).optional(),
    label: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const importContactsBodySchema = z
  .object({
    csv: z.string().min(1).max(70_000_000).optional(),
    /** Base64-encoded .xlsx / .xls bytes (optional data: URL prefix allowed). */
    excelBase64: z.string().min(1).max(70_000_000).optional(),
    /** Original upload name for async job status (optional). */
    fileName: z.string().trim().min(1).max(255).optional(),
    fieldMappings: z.array(importFieldMappingSchema).max(100).optional(),
    /** When true, process small files synchronously (legacy / tests). */
    sync: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasCsv = Boolean(value.csv?.trim());
    const hasExcel = Boolean(value.excelBase64?.trim());

    if (hasCsv === hasExcel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one of csv or excelBase64",
        path: hasCsv ? ["excelBase64"] : ["csv"],
      });
    }
  });

export type ImportContactsBody = z.infer<typeof importContactsBodySchema>;
export type ImportFieldMappingInput = z.infer<typeof importFieldMappingSchema>;

export const exportContactsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  isActive: z
    .enum(["true", "false", "all"])
    .optional()
    .default("all"),
  categoryId: z.string().trim().min(1).max(100).optional(),
  occasionId: z.string().trim().min(1).max(100).optional(),
  cursor: z.string().trim().min(1).max(100).optional(),
});

export type ExportContactsQuery = z.infer<typeof exportContactsQuerySchema>;
