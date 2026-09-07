import { createHmac } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import { processRazorpayWebhook } from "@/lib/billing/webhook";
import { getPlanCatalogueEntry } from "@/lib/billing/catalogue";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { POST as razorpayWebhook } from "@/app/api/v1/billing/webhooks/razorpay/route";
import  { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;


describe("billing webhook (REQ-BILL)", () => {
  beforeAll(async () => {
    if (!databaseUrl) {
      return;
    }

    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("applies STARTER limits from catalogue on payment.captured and is idempotent", async () => {
    if (!databaseAvailable) {
      return;
    }

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization({
      organizationName: `Billing Org ${suffix}`,
      organizationSlug: `billing-org-${suffix}`,
      timezone: "UTC",
      adminName: "Billing Owner",
      email: `billing-owner-${suffix}@example.com`,
      password: "Password123!",
    });

    const eventId = `evt_${suffix}`;
    const payload = {
      id: eventId,
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: `pay_${suffix}`,
            order_id: `order_${suffix}`,
            status: "captured",
            notes: {
              organizationId: org.organization.id,
              plan: SubscriptionPlan.STARTER,
            },
          },
        },
      },
    };

    const first = await processRazorpayWebhook(payload);
    expect(first).toMatchObject({
      outcome: "applied",
      action: "activated",
      organizationId: org.organization.id,
    });

    // Catalogue is DB-backed and admin-editable -- assert against the live
    // entry, not a hardcoded default, so this test is robust to real edits.
    const catalogue = await getPlanCatalogueEntry(SubscriptionPlan.STARTER);
    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: org.organization.id },
    });
    expect(sub.plan).toBe(SubscriptionPlan.STARTER);
    expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
    expect(sub.contactLimit).toBe(catalogue.contactLimit);
    expect(sub.monthlyMessageLimit).toBe(catalogue.monthlyMessageLimit);

    const second = await processRazorpayWebhook(payload);
    expect(second).toMatchObject({ outcome: "duplicate", eventId });

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("marks PAST_DUE on payment.failed so sending stays blocked", async () => {
    if (!databaseAvailable) {
      return;
    }

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization({
      organizationName: `Billing Fail ${suffix}`,
      organizationSlug: `billing-fail-${suffix}`,
      timezone: "UTC",
      adminName: "Billing Fail",
      email: `billing-fail-${suffix}@example.com`,
      password: "Password123!",
    });

    await processRazorpayWebhook({
      id: `evt_fail_${suffix}`,
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: `pay_fail_${suffix}`,
            order_id: `order_fail_${suffix}`,
            notes: {
              organizationId: org.organization.id,
              plan: SubscriptionPlan.PRO,
            },
          },
        },
      },
    });

    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: org.organization.id },
    });
    expect(sub.status).toBe(SubscriptionStatus.PAST_DUE);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("rejects webhooks with bad signatures when keys are set", async () => {
    const previous = {
      BILLING_ENABLED: process.env.BILLING_ENABLED,
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    };

    process.env.BILLING_ENABLED = "true";
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test";

    try {
      const body = JSON.stringify({ id: "evt_bad", event: "payment.captured" });
      const response = await razorpayWebhook(
        new Request("http://localhost/api/v1/billing/webhooks/razorpay", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-razorpay-signature": "invalid",
          },
          body,
        }),
      );
      expect(response.status).toBe(400);

      const goodSig = createHmac("sha256", "whsec_test")
        .update(body)
        .digest("hex");
      const okResponse = await razorpayWebhook(
        new Request("http://localhost/api/v1/billing/webhooks/razorpay", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-razorpay-signature": goodSig,
          },
          body,
        }),
      );
      // Missing notes → ignored but signature accepted
      expect(okResponse.status).toBe(200);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});
