import { Channel } from "@prisma/client";
import { z } from "zod";

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format");

export const exportActivityQuerySchema = z.object({
  tab: z.enum(["upcoming", "sent", "failed"]),
  search: z.string().trim().max(100).optional(),
  channel: z.nativeEnum(Channel).optional(),
  occasionId: z.string().trim().min(1).max(100).optional(),
  categoryId: z.string().trim().min(1).max(100).optional(),
  date: dateSchema.optional(),
});

export type ExportActivityQuery = z.infer<typeof exportActivityQuerySchema>;
