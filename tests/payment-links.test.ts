import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createLink: vi.fn(),
  cancelLink: vi.fn(),
}));

vi.mock("@/lib/billing/razorpay", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing/razorpay")>(
    "@/lib/billing/razorpay",
  );
  return {
    ...actual,
    requireRazorpayCredentials: () => ({
      keyId: "rzp_test_key",
      keySecret: "rzp_test_secret",
      webhookSecret: "whsec_test",
    }),
    createRazorpayPaymentLink: mocks.createLink,
    cancelRazorpayPaymentLink: mocks.cancelLink,
  };
});

import { SubscriptionPlan } from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { activatePlanDealDirectly } from "@/lib/billing/apply-plan";
import { RazorpayApiError } from "@/lib/billing/razorpay";
import {
  ActivePlanRenewalConfirmationRequiredError,
  BillingValidationError,
  cancelAdminPaymentLink,
  createAdminPaymentLink,
} from "@/lib/billing/service";
import { processRazorpayWebhook } from "@/lib/billing/webhook";
import { prisma } from "@/lib/db";
import { cleanupOrganization, uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `Payment Link Org ${suffix}`,
    organizationSlug: `payment-link-org-${suffix}`,
    timezone: "UTC",
    adminName: "Payment Link Admin",
    email: `payment-link-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

function fakeLink(id: string, status = "created") {
  return { id, short_url: `https://rzp.io/${id}`, status, amount: 49_900 };
}

describe("admin payment links: auto-supersede and cancel", () => {
  beforeAll(async () => {
    if (!databaseUrl) return;
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creating a second link auto-cancels the first outstanding one (STARTER)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      mocks.createLink.mockResolvedValueOnce(fakeLink("plink_1"));
      const first = await createAdminPaymentLink({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.STARTER,
        amountPaise: 49_900,
      });
      expect(first.supersededCheckoutIds).toEqual([]);
      expect(mocks.cancelLink).not.toHaveBeenCalled();

      mocks.cancelLink.mockResolvedValueOnce(fakeLink("plink_1", "cancelled"));
      mocks.createLink.mockResolvedValueOnce(fakeLink("plink_2"));
      const second = await createAdminPaymentLink({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.STARTER,
        amountPaise: 49_900,
      });

      expect(mocks.cancelLink).toHaveBeenCalledWith(
        "plink_1",
        expect.anything(),
      );
      expect(second.supersededCheckoutIds).toHaveLength(1);

      const checkouts = await prisma.billingCheckout.findMany({
        where: { organizationId: org.organization.id },
        orderBy: { createdAt: "asc" },
      });
      expect(checkouts).toHaveLength(2);
      expect(checkouts[0]!.status).toBe("CANCELLED");
      expect(checkouts[1]!.status).toBe("CREATED");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("aborts without creating a new link if the old one cannot be cancelled", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      mocks.createLink.mockResolvedValueOnce(fakeLink("plink_1"));
      await createAdminPaymentLink({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.PRO,
        amountPaise: 1_499_00,
      });

      mocks.cancelLink.mockRejectedValueOnce(
        new RazorpayApiError("already paid", 400),
      );

      await expect(
        createAdminPaymentLink({
          organizationId: org.organization.id,
          plan: SubscriptionPlan.PRO,
          amountPaise: 1_499_00,
        }),
      ).rejects.toThrow(BillingValidationError);

      // The original link is untouched (not force-marked CANCELLED), and no
      // second link/checkout was created.
      const checkouts = await prisma.billingCheckout.findMany({
        where: { organizationId: org.organization.id },
      });
      expect(checkouts).toHaveLength(1);
      expect(checkouts[0]!.status).toBe("CREATED");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("cancelAdminPaymentLink flips a CREATED link to CANCELLED", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      mocks.createLink.mockResolvedValueOnce(fakeLink("plink_1"));
      await createAdminPaymentLink({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.STARTER,
        amountPaise: 49_900,
      });
      const checkout = await prisma.billingCheckout.findFirstOrThrow({
        where: { organizationId: org.organization.id },
      });

      mocks.cancelLink.mockResolvedValueOnce(fakeLink("plink_1", "cancelled"));
      const updated = await cancelAdminPaymentLink(
        org.organization.id,
        checkout.id,
      );
      expect(updated.status).toBe("CANCELLED");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("cancelAdminPaymentLink rejects a link that isn't CREATED", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      mocks.createLink.mockResolvedValueOnce(fakeLink("plink_1"));
      await createAdminPaymentLink({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.STARTER,
        amountPaise: 49_900,
      });
      const checkout = await prisma.billingCheckout.findFirstOrThrow({
        where: { organizationId: org.organization.id },
      });

      mocks.cancelLink.mockResolvedValueOnce(fakeLink("plink_1", "cancelled"));
      await cancelAdminPaymentLink(org.organization.id, checkout.id);

      await expect(
        cancelAdminPaymentLink(org.organization.id, checkout.id),
      ).rejects.toThrow(BillingValidationError);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("webhook ignores a payment event for an already-CANCELLED checkout", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      const checkout = await prisma.billingCheckout.create({
        data: {
          organizationId: org.organization.id,
          kind: "PAYMENT_LINK",
          plan: SubscriptionPlan.CUSTOM,
          razorpayOrderId: `plink_test_${uniqueSuffix()}`,
          razorpayPaymentLinkId: `plink_${uniqueSuffix()}`,
          amountPaise: 10_000_00,
          durationDays: 30,
          dealContactLimit: 5000,
          dealSmsLimit: 3000,
          dealWhatsappLimit: 1500,
          dealEmailLimit: 500,
          status: "CANCELLED",
        },
      });

      await processRazorpayWebhook({
        id: `evt_${uniqueSuffix()}`,
        event: "payment_link.paid",
        payload: {
          payment_link: {
            entity: {
              id: checkout.razorpayPaymentLinkId!,
              notes: {
                organizationId: org.organization.id,
                kind: "PAYMENT_LINK",
                plan: "CUSTOM",
              },
            },
          },
        },
      });

      const subscription = await prisma.subscription.findUnique({
        where: { organizationId: org.organization.id },
      });
      // Registration seeds a FREE subscription; the cancelled link must not
      // have upgraded it to CUSTOM.
      expect(subscription?.plan).not.toBe(SubscriptionPlan.CUSTOM);

      const deals = await prisma.planDeal.findMany({
        where: { organizationId: org.organization.id },
      });
      expect(deals).toHaveLength(0);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("requires confirmRenewal to create a payment link while a CUSTOM deal is active and unexpired", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const admin = await prisma.platformAdmin.create({
      data: {
        email: `guard-admin-${uniqueSuffix()}@test.local`,
        passwordHash: "x",
        name: "Guard Admin",
      },
    });
    try {
      await activatePlanDealDirectly({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.CUSTOM,
        amountPaise: 10_000_00,
        contactLimit: 5000,
        smsMonthlyLimit: 3000,
        whatsappMonthlyLimit: 1500,
        emailMonthlyLimit: 500,
        durationDays: 30,
        createdByAdminId: admin.id,
      });

      await expect(
        createAdminPaymentLink({
          organizationId: org.organization.id,
          plan: SubscriptionPlan.STARTER,
          amountPaise: 49_900,
        }),
      ).rejects.toThrow(ActivePlanRenewalConfirmationRequiredError);
      expect(mocks.createLink).not.toHaveBeenCalled();

      mocks.createLink.mockResolvedValueOnce(fakeLink("plink_1"));
      const link = await createAdminPaymentLink({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.STARTER,
        amountPaise: 49_900,
        confirmRenewal: true,
      });
      expect(link.paymentLinkId).toBe("plink_1");
    } finally {
      await cleanupOrganization(org.organization.id);
      await prisma.platformAdmin.delete({ where: { id: admin.id } }).catch(() => {});
    }
  });

  it("needs no confirmation for a payment link when there is no active plan yet", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      mocks.createLink.mockResolvedValueOnce(fakeLink("plink_1"));
      const link = await createAdminPaymentLink({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.STARTER,
        amountPaise: 49_900,
      });
      expect(link.paymentLinkId).toBe("plink_1");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });
});
