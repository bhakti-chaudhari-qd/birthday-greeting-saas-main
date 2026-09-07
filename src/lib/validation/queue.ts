import { z } from "zod";

import { Channel, QueueStatus } from "@prisma/client";

const targetDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Target date must use YYYY-MM-DD format");

export const generateQueueSchema = z
  .object({
    templateId: z.string().trim().min(1),
    targetDate: targetDateSchema.optional(),
  })
  .strict();

export const listQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.nativeEnum(QueueStatus).optional(),
  channel: z.nativeEnum(Channel).optional(),
  occasionId: z.string().trim().min(1).max(100).optional(),
  categoryId: z.string().trim().min(1).max(100).optional(),
  scheduledDate: targetDateSchema.optional(),
});

export type GenerateQueueInput = z.infer<typeof generateQueueSchema>;
export type ListQueueQuery = z.infer<typeof listQueueQuerySchema>;
