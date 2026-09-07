import { ChannelProvider } from "@prisma/client";
import { z } from "zod";

/** Production channel configuration is live-only - no Test/Simulation provider option. */
const supportedEmailProviders = [ChannelProvider.RESEND] as const;

export const emailChannelConfigWriteSchema = z
  .object({
    provider: z.enum(supportedEmailProviders),
    isActive: z.boolean().default(true),
    /** Resend API key. Omit on an edit to keep the existing key unchanged. */
    apiKey: z.string().trim().min(1).max(500).optional(),
    fromEmail: z.string().trim().email().max(320).optional(),
    fromName: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.provider !== ChannelProvider.RESEND) {
      return;
    }

    if (!value.fromEmail?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "From email is required for Resend",
        path: ["fromEmail"],
      });
    }
  });

/**
 * Service-layer contract, intentionally wider than emailChannelConfigWriteSchema
 * above: the production PUT /channel-config/email route validates against
 * that schema (RESEND only), but upsertEmailChannelConfig is also called
 * directly by automated tests to create ChannelConfig fixtures with
 * provider: TEST, bypassing the production write-schema entirely. Keeping
 * TEST here is what lets that test infrastructure keep typechecking - see
 * the docblock on resolveMessageProvider in messaging/providers/factory.ts.
 */
export type EmailChannelConfigWriteInput = Omit<
  z.input<typeof emailChannelConfigWriteSchema>,
  "provider"
> & {
  provider: typeof ChannelProvider.TEST | typeof ChannelProvider.RESEND;
};
