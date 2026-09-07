import { ChannelProvider } from "@prisma/client";
import { z } from "zod";

/** Production channel configuration is live-only - no Test/Simulation provider option. */
const supportedSmsProviders = [ChannelProvider.CUSTOM_HTTP] as const;

export const smsChannelConfigWriteSchema = z
  .object({
    provider: z.enum(supportedSmsProviders),
    isActive: z.boolean().default(true),
    username: z.string().trim().min(1).max(200).optional(),
    password: z.string().max(200).optional(),
    baseUrl: z.string().trim().url().optional(),
    sendPath: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .regex(/^\//, "Send path must start with /")
      .optional(),
    route: z.string().trim().min(1).max(100).optional(),
    senderId: z.string().trim().min(1).max(20).optional(),
    requestTimeoutMs: z.number().int().min(1_000).max(120_000).optional(),
    successStatusCode: z.number().int().min(0).max(9999).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.provider !== ChannelProvider.CUSTOM_HTTP) {
      return;
    }

    if (!value.username?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Username is required for Custom HTTP SMS",
        path: ["username"],
      });
    }

    if (!value.baseUrl?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Base URL is required for Custom HTTP SMS",
        path: ["baseUrl"],
      });
    }

    if (!value.sendPath?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Send path is required for Custom HTTP SMS",
        path: ["sendPath"],
      });
    }

    if (!value.route?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Route is required for Custom HTTP SMS",
        path: ["route"],
      });
    }

    if (!value.senderId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sender ID is required for Custom HTTP SMS",
        path: ["senderId"],
      });
    }
  });

/**
 * Service-layer contract, intentionally wider than smsChannelConfigWriteSchema
 * above: the production PUT /channel-config/sms route validates against that
 * schema (CUSTOM_HTTP only), but upsertSmsChannelConfig is also called
 * directly by automated tests to create ChannelConfig fixtures with
 * provider: TEST, bypassing the production write-schema entirely. Keeping
 * TEST here is what lets that test infrastructure keep typechecking - see
 * the docblock on resolveMessageProvider in messaging/providers/factory.ts.
 */
export type SmsChannelConfigWriteInput = Omit<
  z.input<typeof smsChannelConfigWriteSchema>,
  "provider"
> & {
  provider: typeof ChannelProvider.TEST | typeof ChannelProvider.CUSTOM_HTTP;
};
