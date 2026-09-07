import { z } from "zod";

export const smsCredentialsSchema = z
  .object({
    username: z.string().trim().min(1),
    password: z.string().min(1),
  })
  .strict();

export const smsSettingsSchema = z
  .object({
    /** Required per tenant - no product default vendor URL. */
    baseUrl: z.string().trim().url(),
    /** Required per tenant - e.g. /send.aspx */
    sendPath: z
      .string()
      .trim()
      .min(1)
      .regex(/^\//, "Send path must start with /"),
    route: z.string().trim().min(1),
    senderId: z.string().trim().min(1),
    requestTimeoutMs: z.number().int().min(1_000).max(120_000).optional(),
    successStatusCode: z.number().int().min(0).max(9999).optional(),
  })
  .strict();

export type SmsCredentials = z.infer<typeof smsCredentialsSchema>;
export type SmsSettings = z.infer<typeof smsSettingsSchema>;

export type ResolvedSmsProviderConfig = {
  baseUrl: string;
  sendPath: string;
  username: string;
  password: string;
  route: string;
  senderId: string;
  requestTimeoutMs: number;
  successStatusCode: number;
};
