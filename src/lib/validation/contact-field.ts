import { ContactFieldType } from "@prisma/client";
import { z } from "zod";

export const contactFieldTypeSchema = z.nativeEnum(ContactFieldType);

export const createContactFieldDefinitionSchema = z
  .object({
    key: z.string().trim().max(80).optional(),
    label: z.string().trim().min(1).max(80),
    type: contactFieldTypeSchema.optional().default(ContactFieldType.TEXT),
    options: z.unknown().nullable().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const updateContactFieldDefinitionSchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional(),
    type: contactFieldTypeSchema.optional(),
    options: z.unknown().nullable().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateContactFieldDefinitionInput = z.infer<
  typeof createContactFieldDefinitionSchema
>;
export type UpdateContactFieldDefinitionInput = z.infer<
  typeof updateContactFieldDefinitionSchema
>;
