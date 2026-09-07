import { z } from "zod";

export const occasionsDayQuerySchema = z.object({
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
    .optional(),
  categoryId: z.string().trim().min(1).max(100).optional(),
});

export type OccasionsDayQuery = z.infer<typeof occasionsDayQuerySchema>;
