import { z } from "zod";

import { SubscriptionPlan } from "@prisma/client";

import { CREDIT_PACK_IDS } from "@/lib/billing/catalogue";

const creditPackIdSchema = z.enum(
  CREDIT_PACK_IDS as [string, ...string[]],
);

export const billingCheckoutSchema = z
  .object({
    plan: z.enum([SubscriptionPlan.STARTER, SubscriptionPlan.PRO]).optional(),
    packId: creditPackIdSchema.optional(),
  })
  .refine(
    (value) => Boolean(value.plan) !== Boolean(value.packId),
    {
      message: "Provide either plan or packId",
      path: ["plan"],
    },
  );

export const billingConfirmSchema = z
  .object({
    plan: z.enum([SubscriptionPlan.STARTER, SubscriptionPlan.PRO]).optional(),
    packId: creditPackIdSchema.optional(),
    orderId: z.string().min(1).optional(),
    subscriptionId: z.string().min(1).optional(),
    paymentId: z.string().min(1),
    signature: z.string().min(1),
  })
  .refine(
    (value) => Boolean(value.plan) !== Boolean(value.packId),
    {
      message: "Provide either plan or packId",
      path: ["plan"],
    },
  )
  .refine(
    (value) => {
      if (value.packId) {
        return Boolean(value.orderId);
      }
      return Boolean(value.orderId) || Boolean(value.subscriptionId);
    },
    {
      message: "Provide orderId and/or subscriptionId",
      path: ["orderId"],
    },
  );
