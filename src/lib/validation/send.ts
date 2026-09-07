import { Channel, DeliveryStatus, QueueStatus } from "@prisma/client";
import { z } from "zod";

const queueIdSchema = z.string().trim().min(1);

export const sendQueueSchema = z
  .object({
    queueIds: z.array(queueIdSchema).min(1).max(50),
  })
  .strict();

export const retryQueueSchema = z
  .object({
    confirmAmbiguousRetry: z.boolean().optional(),
  })
  .strict();

const deliveryListFiltersSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.nativeEnum(DeliveryStatus).optional(),
  channel: z.nativeEnum(Channel).optional(),
  // Only providers the product can configure today (no MSG91/Twilio/Meta UI).
  provider: z.enum(["TEST", "CUSTOM_HTTP"]).optional(),
  sendQueueId: queueIdSchema.optional(),
  queueStatus: z.nativeEnum(QueueStatus).optional(),
  outcome: z.enum(["sent", "not_delivered"]).optional(),
  occasionId: z.string().trim().min(1).max(100).optional(),
  categoryId: z.string().trim().min(1).max(100).optional(),
  /** Greeting day (YYYY-MM-DD), matches send queue scheduledDate (IST calendar day). */
  scheduledDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
    .optional(),
});

export const listDeliveriesQuerySchema = deliveryListFiltersSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const exportDeliveriesQuerySchema = deliveryListFiltersSchema;

export type SendQueueInput = z.infer<typeof sendQueueSchema>;
export type RetryQueueInput = z.infer<typeof retryQueueSchema>;
export type ListDeliveriesQuery = z.infer<typeof listDeliveriesQuerySchema>;
export type ExportDeliveriesQuery = z.infer<typeof exportDeliveriesQuerySchema>;
