import { z } from "zod";

export const voiceChannelConfigWriteSchema = z
  .object({
    isActive: z.boolean().default(true),
    // Plain http is accepted, as for SMS gateways: many offer no https endpoint.
    baseUrl: z
      .string()
      .trim()
      .url()
      .max(500)
      .regex(/^https?:\/\//i, "Base URL must start with http:// or https://"),
    sendPath: z
      .string()
      .trim()
      .max(200)
      .regex(/^\/\S*$/, "Send path must start with /"),
    username: z.string().trim().min(1).max(200),
    /** Omit on an edit to keep the existing password unchanged. */
    password: z.string().min(1).max(500).optional(),
    route: z.string().trim().min(1).max(100),
    callerId: z.string().trim().min(1).max(100),
  })
  .strict();

export type VoiceChannelConfigWriteInput = z.input<
  typeof voiceChannelConfigWriteSchema
>;
