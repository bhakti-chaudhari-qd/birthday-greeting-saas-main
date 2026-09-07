import { z } from "zod";

export const emailResendCredentialsSchema = z
  .object({
    apiKey: z.string().trim().min(1),
  })
  .strict();

export const emailResendSettingsSchema = z
  .object({
    fromEmail: z.string().trim().email(),
    fromName: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export type EmailResendCredentials = z.infer<typeof emailResendCredentialsSchema>;
export type EmailResendSettings = z.infer<typeof emailResendSettingsSchema>;

export type ResolvedEmailProviderConfig = {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
};
