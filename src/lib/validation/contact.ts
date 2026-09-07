import { z } from "zod";

import {
  MOBILE_MUST_BE_TEN_DIGITS_MESSAGE,
  normalizeMobile,
} from "@/lib/contacts/mobile";
import {
  CSV_OCCASION_DATE_FORMAT_MESSAGE,
  normalizeCsvOccasionDateToIso,
} from "@/lib/contacts/dates";

const contactMobileSchema = z
  .string()
  .trim()
  .min(10)
  .max(16)
  .superRefine((value, ctx) => {
    try {
      const normalized = normalizeMobile(value);
      if (normalized.length !== 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: MOBILE_MUST_BE_TEN_DIGITS_MESSAGE,
        });
      }
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          error instanceof Error
            ? error.message
            : MOBILE_MUST_BE_TEN_DIGITS_MESSAGE,
      });
    }
  });

const categoryIdSchema = z.string().trim().min(1).max(100);
const categoryNameSchema = z.string().trim().min(1).max(50);

const contactEmailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .max(254)
  .optional()
  .nullable();

const contactAttributesSchema = z
  .record(
    z.string().trim().min(1).max(50),
    z.union([z.string().max(1000), z.number(), z.boolean(), z.null()]),
  )
  .optional();

const contactCsvOccasionDateSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    try {
      normalizeCsvOccasionDateToIso(value);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          error instanceof Error
            ? error.message
            : CSV_OCCASION_DATE_FORMAT_MESSAGE,
      });
    }
  });

/**
 * Value per occasionId: a "YYYY-MM-DD" date, or null/omitted to clear it.
 * Keys are opaque org-scoped ids, not format-checked against cuid() - not
 * every Occasion row in this database was created with Prisma's default id
 * generator, and membership is already verified in applyContactOccasionDates.
 */
const occasionDatesSchema = z.record(
  z.string().trim().min(1).max(100),
  z.string().trim().min(1).nullable(),
);

export const createContactSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    mobile: contactMobileSchema,
    email: contactEmailSchema,
    occasionDates: occasionDatesSchema.optional(),
    categoryId: categoryIdSchema.optional().nullable(),
    categoryName: categoryNameSchema.optional().nullable(),
    address: z.string().trim().max(500).optional().nullable(),
    note: z.string().trim().max(1000).optional().nullable(),
    attributes: contactAttributesSchema,
    isActive: z.boolean().optional().default(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.categoryId != null && value.categoryName != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide categoryId or categoryName, not both",
        path: ["categoryName"],
      });
    }
  });

export const updateContactSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    mobile: contactMobileSchema.optional(),
    email: contactEmailSchema,
    occasionDates: occasionDatesSchema.optional(),
    categoryId: categoryIdSchema.nullable().optional(),
    categoryName: categoryNameSchema.nullable().optional(),
    address: z.string().trim().max(500).nullable().optional(),
    note: z.string().trim().max(1000).nullable().optional(),
    attributes: contactAttributesSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.categoryId != null && value.categoryName != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide categoryId or categoryName, not both",
        path: ["categoryName"],
      });
    }
  });

export const listContactsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  isActive: z
    .enum(["true", "false", "all"])
    .optional()
    .default("all"),
  categoryId: z.string().trim().min(1).max(100).optional(),
  occasionId: z.string().trim().min(1).max(100).optional(),
});

export const contactCsvRowSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    mobile: contactMobileSchema,
    email: contactEmailSchema,
    occasions: z
      .record(
        z.string().trim().min(1).max(100),
        contactCsvOccasionDateSchema,
      )
      .optional(),
    categoryName: categoryNameSchema.nullable(),
    address: z.string().trim().max(500).nullable(),
    note: z.string().trim().max(1000).nullable(),
    attributes: contactAttributesSchema,
    isActive: z.boolean(),
  })
  .strict();

export type ContactCsvRowInput = z.infer<typeof contactCsvRowSchema>;

export const bulkContactIdsSchema = z
  .object({
    ids: z
      .array(z.string().trim().min(1).max(100))
      .min(1, "Select at least one contact")
      .max(200, "You can update at most 200 contacts at once"),
  })
  .strict();

export const bulkUpdateContactStatusSchema = bulkContactIdsSchema
  .extend({
    isActive: z.boolean(),
  })
  .strict();

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;
export type BulkContactIdsInput = z.infer<typeof bulkContactIdsSchema>;
export type BulkUpdateContactStatusInput = z.infer<
  typeof bulkUpdateContactStatusSchema
>;

export const createContactCategorySchema = z
  .object({
    name: categoryNameSchema,
  })
  .strict();

export const updateContactCategorySchema = z
  .object({
    name: categoryNameSchema,
  })
  .strict();

export type CreateContactCategoryInput = z.infer<
  typeof createContactCategorySchema
>;
export type UpdateContactCategoryInput = z.infer<
  typeof updateContactCategorySchema
>;
