import { z } from "zod";

const contactIdSchema = z.string().trim().min(1);
const quickRecipientSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    mobile: z.string().trim().min(1).max(16),
    email: z.string().trim().email().max(254).optional().nullable(),
  })
  .strict();

export const manualSendRequestSchema = z
  .object({
    templateId: z.string().trim().min(1),
    contactIds: z.array(contactIdSchema).max(50).optional().default([]),
    recipients: z.array(quickRecipientSchema).max(50).optional().default([]),
    /** Client UUID for one Confirm click; shared across batches. Retries with the same id do not create duplicates. */
    clientOperationId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.contactIds.length === 0 && value.recipients.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one recipient",
        path: ["contactIds"],
      });
    }
  });

/** Preview may omit recipients to show a sample render of the template body. */
export const manualSendPreviewRequestSchema = z
  .object({
    templateId: z.string().trim().min(1),
    contactIds: z.array(contactIdSchema).max(50).optional().default([]),
    recipients: z.array(quickRecipientSchema).max(50).optional().default([]),
  })
  .strict();

export type QuickListRecipientInput = z.infer<typeof quickRecipientSchema>;
export type ManualSendRequestInput = {
  templateId: string;
  contactIds?: string[];
  recipients?: QuickListRecipientInput[];
  clientOperationId?: string;
};
export type ManualSendPreviewRequestInput = {
  templateId: string;
  contactIds?: string[];
  recipients?: QuickListRecipientInput[];
};

export function dedupeContactIds(contactIds: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const contactId of contactIds) {
    if (!seen.has(contactId)) {
      seen.add(contactId);
      deduped.push(contactId);
    }
  }

  return deduped;
}
