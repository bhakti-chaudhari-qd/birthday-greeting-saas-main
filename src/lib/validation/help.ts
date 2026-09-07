import { z } from "zod";

export const helpChatMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(2000),
  })
  .strict();

export const helpChatSchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
    /** Optional prior turns for short follow-ups (last few only). */
    history: z.array(helpChatMessageSchema).max(8).optional().default([]),
  })
  .strict();

export type HelpChatInput = z.infer<typeof helpChatSchema>;
export type HelpChatMessage = z.infer<typeof helpChatMessageSchema>;
