import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

import { applyCheckoutPlanToOrganization, applyCreditPackToOrganization } from "@/lib/billing/apply-plan";
import {
  CREDIT_PACK_CATALOGUE,
  PLAN_CATALOGUE,
  canPurchaseCreditPacks,
  formatInrFromPaise,
  isCheckoutPlan,
  isCreditPackId,
} from "@/lib/billing/catalogue";
import {
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from "@/lib/billing/razorpay";
import { assertSubscriptionAllowsSending } from "@/lib/abuse/subscription-send";

describe("billing catalogue", () => {
  it("exposes FREE / STARTER / PRO / CUSTOM with server-owned limits", () => {
    expect(PLAN_CATALOGUE.FREE.contactLimit).toBe(500);
    expect(PLAN_CATALOGUE.STARTER.amountPaise).toBe(499_00);
    expect(PLAN_CATALOGUE.STARTER.contactLimit).toBe(1_000);
    expect(PLAN_CATALOGUE.STARTER.monthlyMessageLimit).toBe(10_000);
    expect(PLAN_CATALOGUE.PRO.amountPaise).toBe(1_499_00);
    expect(PLAN_CATALOGUE.PRO.contactLimit).toBe(10_000);
    expect(PLAN_CATALOGUE.PRO.monthlyMessageLimit).toBe(100_000);
    expect(PLAN_CATALOGUE.CUSTOM.checkoutEnabled).toBe(false);
    expect(PLAN_CATALOGUE.STARTER.checkoutEnabled).toBe(true);
  });

  it("does not treat FREE or CUSTOM as checkout plans", () => {
    expect(isCheckoutPlan("FREE")).toBe(false);
    expect(isCheckoutPlan("CUSTOM")).toBe(false);
    expect(isCheckoutPlan("STARTER")).toBe(true);
    expect(isCheckoutPlan("PRO")).toBe(true);
  });

  it("exposes fixed credit packs with server-owned prices", () => {
    expect(CREDIT_PACK_CATALOGUE["credits-5k"].messages).toBe(5_000);
    expect(CREDIT_PACK_CATALOGUE["credits-5k"].amountPaise).toBe(299_00);
    expect(CREDIT_PACK_CATALOGUE["credits-25k"].messages).toBe(25_000);
    expect(CREDIT_PACK_CATALOGUE["credits-25k"].amountPaise).toBe(999_00);
    expect(isCreditPackId("credits-5k")).toBe(true);
    expect(isCreditPackId("credits-99k")).toBe(false);
  });

  it("allows credit packs only for ACTIVE paid plans", () => {
    expect(
      canPurchaseCreditPacks({
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
      }),
    ).toBe(true);
    expect(
      canPurchaseCreditPacks({
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
      }),
    ).toBe(false);
    expect(
      canPurchaseCreditPacks({
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.PAST_DUE,
      }),
    ).toBe(false);
  });

  it("formats INR from paise for display", () => {
    expect(formatInrFromPaise(499_00)).toMatch(/499/);
  });
});

describe("razorpay signatures", () => {
  it("verifies webhook HMAC signatures", () => {
    const secret = "whsec_test";
    const body = '{"event":"payment.captured","id":"evt_1"}';
    const signature = createHmac("sha256", secret).update(body).digest("hex");

    expect(verifyRazorpayWebhookSignature(body, signature, secret)).toBe(true);
    expect(verifyRazorpayWebhookSignature(body, "deadbeef", secret)).toBe(
      false,
    );
    expect(verifyRazorpayWebhookSignature(body, null, secret)).toBe(false);
  });

  it("verifies checkout payment signatures", () => {
    const keySecret = "rzp_test_secret";
    const orderId = "order_abc";
    const paymentId = "pay_xyz";
    const signature = createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    expect(
      verifyRazorpayPaymentSignature({
        orderId,
        paymentId,
        signature,
        keySecret,
      }),
    ).toBe(true);

    expect(
      verifyRazorpayPaymentSignature({
        orderId,
        paymentId,
        signature: "nope",
        keySecret,
      }),
    ).toBe(false);
  });
});

describe("subscription unpaid gate (Phase 4 + billing)", () => {
  it("allows ACTIVE and blocks PAST_DUE / CANCELLED after failed billing", () => {
    expect(() =>
      assertSubscriptionAllowsSending({ status: SubscriptionStatus.ACTIVE }),
    ).not.toThrow();

    expect(() =>
      assertSubscriptionAllowsSending({ status: SubscriptionStatus.PAST_DUE }),
    ).toThrow(/past due/i);

    expect(() =>
      assertSubscriptionAllowsSending({ status: SubscriptionStatus.CANCELLED }),
    ).toThrow(/cancelled/i);
  });
});

describe("applyCheckoutPlanToOrganization catalogue trust", () => {
  it("uses server catalogue limits, never client-supplied amounts", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const db = {
      subscription: {
        upsert: async (args: {
          update: Record<string, unknown>;
          create: Record<string, unknown>;
        }) => {
          updates.push(args.update);
          return {
            ...args.update,
            organizationId: "org_1",
            id: "sub_1",
          };
        },
      },
      // No PlanCatalogueRecord row -- getPlanCatalogueEntry falls back to the
      // hardcoded PLAN_CATALOGUE defaults asserted against below.
      planCatalogueRecord: {
        findUnique: async () => null,
      },
    };

    await applyCheckoutPlanToOrganization(
      "org_1",
      SubscriptionPlan.STARTER,
      db as never,
    );

    expect(updates[0]).toMatchObject({
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.ACTIVE,
      contactLimit: PLAN_CATALOGUE.STARTER.contactLimit,
      monthlyMessageLimit: PLAN_CATALOGUE.STARTER.monthlyMessageLimit,
    });
    expect(updates[0]).toHaveProperty("paidUntil");
    expect(updates[0]).not.toHaveProperty("amountPaise");
  });
});

describe("applyCreditPackToOrganization catalogue trust", () => {
  it("increments bonus credits from server pack catalogue", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const db = {
      subscription: {
        findUnique: async () => ({
          id: "sub_1",
          organizationId: "org_1",
          bonusMessageCredits: 0,
        }),
        update: async (args: { data: Record<string, unknown> }) => {
          updates.push(args.data);
          return {
            id: "sub_1",
            organizationId: "org_1",
            bonusMessageCredits: CREDIT_PACK_CATALOGUE["credits-5k"].messages,
          };
        },
      },
    };

    await applyCreditPackToOrganization("org_1", "credits-5k", db as never);

    expect(updates[0]).toEqual({
      bonusMessageCredits: {
        increment: CREDIT_PACK_CATALOGUE["credits-5k"].messages,
      },
    });
  });
});

describe("expireOverduePaidSubscriptions", () => {
  it("marks ACTIVE paid orgs past paidUntil as PAST_DUE", async () => {
    const { expireOverduePaidSubscriptions } = await import(
      "@/lib/billing/apply-plan"
    );
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const findMany = vi.fn().mockResolvedValue([
      { organizationId: "org_a" },
      { organizationId: "org_b" },
    ]);

    const result = await expireOverduePaidSubscriptions(
      {
        subscription: { findMany, updateMany },
      } as never,
      new Date("2026-08-01T00:00:00.000Z"),
    );

    expect(result.expired).toBe(2);
    expect(updateMany).toHaveBeenCalled();
  });
});
