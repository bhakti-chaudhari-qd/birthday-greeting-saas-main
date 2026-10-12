import { z } from "zod";

export const voiceCredentialsSchema = z
  .object({
    username: z.string().trim().min(1),
    password: z.string().min(1),
  })
  .strict();

export const voiceSettingsSchema = z
  .object({
    baseUrl: z.string().trim().url(),
    /** e.g. /SendVoice.aspx */
    sendPath: z
      .string()
      .trim()
      .min(1)
      .regex(/^\//, "Send path must start with /"),
    route: z.string().trim().min(1),
    /** Caller ID verified on the voice gateway account. */
    callerId: z.string().trim().min(1),
    requestTimeoutMs: z.number().int().min(1_000).max(300_000).optional(),
  })
  .strict();

export type VoiceCredentials = z.infer<typeof voiceCredentialsSchema>;
export type VoiceSettings = z.infer<typeof voiceSettingsSchema>;

export type ResolvedVoiceProviderConfig = {
  baseUrl: string;
  sendPath: string;
  username: string;
  password: string;
  route: string;
  callerId: string;
  requestTimeoutMs: number;
};
