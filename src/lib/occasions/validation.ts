import { z } from "zod";

const occasionNameSchema = z.string().trim().min(1).max(50);

export const createOccasionSchema = z
  .object({
    name: occasionNameSchema,
  })
  .strict();

export const updateOccasionSchema = z
  .object({
    name: occasionNameSchema,
  })
  .strict();

export type CreateOccasionInput = z.infer<typeof createOccasionSchema>;
export type UpdateOccasionInput = z.infer<typeof updateOccasionSchema>;
