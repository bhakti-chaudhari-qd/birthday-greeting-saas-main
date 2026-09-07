import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import { Channel, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import {
  activatePlanDealDirectly,
  applyPaymentLinkDealToOrganization,
} from "@/lib/billing/apply-plan";
import { getPlanCatalogueEntry } from "@/lib/billing/catalogue";
import {
  PlanLedgerError,
  getPlanLedgerForOrganization,
  recordPlanPayment,
  topUpCustomPlanChannel,
} from "@/lib/billing/plan-ledger";
import { ActivePlanRenewalConfirmationRequiredError } from "@/lib/billing/service";
import {
  activatePlanForPlatformAdmin,
} from "@/lib/admin/org-ops";
import { prisma } from "@/lib/db";
import { cleanupOrganization, uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;
let adminId: string;

function registerInput(suffix: string) {
  return {
    organizationName: `Ledger Org ${suffix}`,
    organizationSlug: `ledger-org-${suffix}`,
    timezone: "UTC",
    adminName: "Ledger Admin",
    email: `ledger-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

describe("plan deal ledger", () => {
  beforeAll(async () => {
    if (!databaseUrl) return;
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
    if (!databaseAvailable) return;

    const admin = await prisma.platformAdmin.create({
      data: {
        email: `ledger-platform-admin-${uniqueSuffix()}@test.local`,
        passwordHash: await hash("password12345", 12),
        name: "Ledger Test Admin",
      },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.platformAdmin.delete({ where: { id: adminId } }).catch(() => {});
    }
    // Connection stays open for the next describe block in this file, which
    // does its own final $disconnect().
  });

  it("activates a CUSTOM deal directly: ACTIVE + limits + paidUntil = now + duration, deal is UNPAID", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      const before = new Date();
      const { subscription, deal } = await activatePlanDealDirectly({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.CUSTOM,
        amountPaise: 10_000_00,
        contactLimit: 5000,
        smsMonthlyLimit: 3000,
        whatsappMonthlyLimit: 1500,
        emailMonthlyLimit: 500,
        durationDays: 30,
        createdByAdminId: adminId,
      });

      expect(subscription.plan).toBe(SubscriptionPlan.CUSTOM);
      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.contactLimit).toBe(5000);
      expect(subscription.monthlyMessageLimit).toBe(5000);
      const expectedPaidUntil = before.getTime() + 30 * 24 * 60 * 60 * 1000;
      expect(subscription.paidUntil!.getTime()).toBeGreaterThanOrEqual(
        expectedPaidUntil - 5000,
      );
      expect(subscription.paidUntil!.getTime()).toBeLessThanOrEqual(
        expectedPaidUntil + 60_000,
      );

      expect(deal.plan).toBe(SubscriptionPlan.CUSTOM);
      expect(deal.source).toBe("DIRECT");
      expect(deal.amountDuePaise).toBe(10_000_00);
      expect(deal.amountPaidPaise).toBe(0);
      expect(deal.paymentStatus).toBe("UNPAID");

      const ledger = await getPlanLedgerForOrganization(org.organization.id);
      expect(ledger.deals).toHaveLength(1);
      expect(ledger.outstandingBalancePaise).toBe(10_000_00);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("renewal extends paidUntil from the existing value, not from now, and adds a second deal", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      const first = await activatePlanDealDirectly({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.CUSTOM,
        amountPaise: 10_000_00,
        contactLimit: 5000,
        smsMonthlyLimit: 3000,
        whatsappMonthlyLimit: 1500,
        emailMonthlyLimit: 500,
        durationDays: 30,
        createdByAdminId: adminId,
      });
      const firstPaidUntil = first.subscription.paidUntil!.getTime();

      const second = await activatePlanDealDirectly({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.CUSTOM,
        amountPaise: 12_000_00,
        contactLimit: 6000,
        smsMonthlyLimit: 4000,
        whatsappMonthlyLimit: 1500,
        emailMonthlyLimit: 500,
        durationDays: 30,
        createdByAdminId: adminId,
      });

      // Stacks on top of the existing period, not reset to now + 30d.
      expect(second.subscription.paidUntil!.getTime()).toBeGreaterThan(
        firstPaidUntil,
      );
      const expectedSecondPaidUntil = firstPaidUntil + 30 * 24 * 60 * 60 * 1000;
      expect(
        Math.abs(second.subscription.paidUntil!.getTime() - expectedSecondPaidUntil),
      ).toBeLessThan(60_000);

      const ledger = await getPlanLedgerForOrganization(org.organization.id);
      expect(ledger.deals).toHaveLength(2);
      // Renewal doesn't touch the first deal's own payment status.
      const firstDeal = ledger.deals.find((d) => d.id === first.deal.id)!;
      expect(firstDeal.paymentStatus).toBe("UNPAID");
      expect(ledger.outstandingBalancePaise).toBe(10_000_00 + 12_000_00);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("a Razorpay-paid deal creates a PAID ledger row and also extends paidUntil from existing", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      const direct = await activatePlanDealDirectly({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.CUSTOM,
        amountPaise: 5_000_00,
        contactLimit: 2000,
        smsMonthlyLimit: 1000,
        whatsappMonthlyLimit: 500,
        emailMonthlyLimit: 200,
        durationDays: 30,
        createdByAdminId: adminId,
      });
      const beforePaidUntil = direct.subscription.paidUntil!.getTime();

      const checkout = await prisma.billingCheckout.create({
        data: {
          organizationId: org.organization.id,
          kind: "PAYMENT_LINK",
          plan: SubscriptionPlan.CUSTOM,
          razorpayOrderId: `plink_test_${uniqueSuffix()}`,
          amountPaise: 8_000_00,
          status: "CREATED",
        },
      });

      const subscription = await applyPaymentLinkDealToOrganization(
        {
          organizationId: org.organization.id,
          plan: SubscriptionPlan.CUSTOM,
          contactLimit: 2500,
          monthlyMessageLimit: 2000,
          smsLimit: 1200,
          whatsappLimit: 600,
          emailLimit: 200,
          durationDays: 30,
          amountPaise: checkout.amountPaise,
          billingCheckoutId: checkout.id,
        },
        prisma,
      );

      expect(subscription.paidUntil!.getTime()).toBeGreaterThan(beforePaidUntil);

      const ledger = await getPlanLedgerForOrganization(org.organization.id);
      expect(ledger.deals).toHaveLength(2);
      const razorpayDeal = ledger.deals.find((d) => d.source === "RAZORPAY")!;
      expect(razorpayDeal.paymentStatus).toBe("PAID");
      expect(razorpayDeal.amountPaidPaise).toBe(8_000_00);
      expect(razorpayDeal.amountDuePaise).toBe(8_000_00);
      // Only the still-unpaid direct deal counts toward the outstanding balance.
      expect(ledger.outstandingBalancePaise).toBe(5_000_00);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("recordPlanPayment allocates FIFO across unpaid deals and never touches access/expiry", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      const first = await activatePlanDealDirectly({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.CUSTOM,
        amountPaise: 10_000_00,
        contactLimit: 5000,
        smsMonthlyLimit: 3000,
        whatsappMonthlyLimit: 1500,
        emailMonthlyLimit: 500,
        durationDays: 30,
        createdByAdminId: adminId,
      });
      const second = await activatePlanDealDirectly({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.CUSTOM,
        amountPaise: 12_000_00,
        contactLimit: 6000,
        smsMonthlyLimit: 4000,
        whatsappMonthlyLimit: 1500,
        emailMonthlyLimit: 500,
        durationDays: 30,
        createdByAdminId: adminId,
      });

      const subscriptionBefore = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });

      // Pays deal 1 in full (10,000) + partially pays deal 2 (2,000 of 12,000).
      await recordPlanPayment(
        org.organization.id,
        12_000_00,
        "Partial settlement",
        adminId,
      );

      const ledger = await getPlanLedgerForOrganization(org.organization.id);
      const firstDeal = ledger.deals.find((d) => d.id === first.deal.id)!;
      const secondDeal = ledger.deals.find((d) => d.id === second.deal.id)!;

      expect(firstDeal.paymentStatus).toBe("PAID");
      expect(firstDeal.amountPaidPaise).toBe(10_000_00);
      expect(secondDeal.paymentStatus).toBe("PARTIALLY_PAID");
      expect(secondDeal.amountPaidPaise).toBe(2_000_00);
      expect(ledger.outstandingBalancePaise).toBe(12_000_00 - 2_000_00);
      expect(ledger.payments).toHaveLength(1);
      expect(ledger.payments[0]!.amountPaise).toBe(12_000_00);
      expect(ledger.payments[0]!.note).toBe("Partial settlement");

      const subscriptionAfter = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });
      expect(subscriptionAfter.paidUntil!.getTime()).toBe(
        subscriptionBefore.paidUntil!.getTime(),
      );
      expect(subscriptionAfter.status).toBe(subscriptionBefore.status);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("a Razorpay-paid STARTER/PRO checkout creates zero PlanDeal rows (unchanged, out of scope for this PR)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      await applyPaymentLinkDealToOrganization(
        {
          organizationId: org.organization.id,
          plan: SubscriptionPlan.STARTER,
          contactLimit: 1000,
          monthlyMessageLimit: 10_000,
          durationDays: 30,
        },
        prisma,
      );

      const deals = await prisma.planDeal.findMany({
        where: { organizationId: org.organization.id },
      });
      expect(deals).toHaveLength(0);

      const subscription = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });
      expect(subscription.plan).toBe(SubscriptionPlan.STARTER);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });
});

describe("renewal confirmation guard", () => {
  beforeAll(async () => {
    if (!databaseUrl) return;
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
    if (!databaseAvailable) return;

    const admin = await prisma.platformAdmin.create({
      data: {
        email: `renewal-guard-admin-${uniqueSuffix()}@test.local`,
        passwordHash: await hash("password12345", 12),
        name: "Renewal Guard Test Admin",
      },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.platformAdmin.delete({ where: { id: adminId } }).catch(() => {});
    }
    // Connection stays open for the next describe block in this file, which
    // does its own final $disconnect().
  });

  it("requires confirmRenewal when activating while a deal is already active and unexpired", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      await activatePlanForPlatformAdmin(
        org.organization.id,
        {
          plan: SubscriptionPlan.CUSTOM,
          amountPaise: 10_000_00,
          contactLimit: 5000,
          smsMonthlyLimit: 3000,
          whatsappMonthlyLimit: 1500,
          emailMonthlyLimit: 500,
          durationDays: 30,
        },
        adminId,
      );

      await expect(
        activatePlanForPlatformAdmin(
          org.organization.id,
          {
            plan: SubscriptionPlan.CUSTOM,
            amountPaise: 5_000_00,
            contactLimit: 5000,
            smsMonthlyLimit: 3000,
            whatsappMonthlyLimit: 1500,
            emailMonthlyLimit: 500,
            durationDays: 30,
          },
          adminId,
        ),
      ).rejects.toThrow(ActivePlanRenewalConfirmationRequiredError);

      // No second deal was created by the rejected attempt.
      const ledger = await getPlanLedgerForOrganization(org.organization.id);
      expect(ledger.deals).toHaveLength(1);

      // Succeeds once confirmed.
      const confirmed = await activatePlanForPlatformAdmin(
        org.organization.id,
        {
          plan: SubscriptionPlan.CUSTOM,
          amountPaise: 5_000_00,
          contactLimit: 5000,
          smsMonthlyLimit: 3000,
          whatsappMonthlyLimit: 1500,
          emailMonthlyLimit: 500,
          durationDays: 30,
          confirmRenewal: true,
        },
        adminId,
      );
      expect(confirmed.planLedger.deals).toHaveLength(2);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("needs no confirmation for a first-time activation", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      const result = await activatePlanForPlatformAdmin(
        org.organization.id,
        {
          plan: SubscriptionPlan.CUSTOM,
          amountPaise: 10_000_00,
          contactLimit: 5000,
          smsMonthlyLimit: 3000,
          whatsappMonthlyLimit: 1500,
          emailMonthlyLimit: 500,
          durationDays: 30,
        },
        adminId,
      );
      expect(result.planLedger.deals).toHaveLength(1);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("needs no confirmation once the existing deal has expired", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      await activatePlanForPlatformAdmin(
        org.organization.id,
        {
          plan: SubscriptionPlan.CUSTOM,
          amountPaise: 10_000_00,
          contactLimit: 5000,
          smsMonthlyLimit: 3000,
          whatsappMonthlyLimit: 1500,
          emailMonthlyLimit: 500,
          durationDays: 30,
        },
        adminId,
      );
      // Force the subscription into the past so it reads as expired.
      await prisma.subscription.update({
        where: { organizationId: org.organization.id },
        data: { paidUntil: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      const result = await activatePlanForPlatformAdmin(
        org.organization.id,
        {
          plan: SubscriptionPlan.CUSTOM,
          amountPaise: 5_000_00,
          contactLimit: 5000,
          smsMonthlyLimit: 3000,
          whatsappMonthlyLimit: 1500,
          emailMonthlyLimit: 500,
          durationDays: 30,
        },
        adminId,
      );
      expect(result.planLedger.deals).toHaveLength(2);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("applies uniformly to STARTER/PRO direct activation, using the same shared error class as CUSTOM", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      await activatePlanForPlatformAdmin(
        org.organization.id,
        { plan: SubscriptionPlan.STARTER, durationDays: 30 },
        adminId,
      );

      await expect(
        activatePlanForPlatformAdmin(
          org.organization.id,
          { plan: SubscriptionPlan.PRO, durationDays: 30 },
          adminId,
        ),
      ).rejects.toThrow(ActivePlanRenewalConfirmationRequiredError);

      const confirmed = await activatePlanForPlatformAdmin(
        org.organization.id,
        { plan: SubscriptionPlan.PRO, durationDays: 30, confirmRenewal: true },
        adminId,
      );
      expect(confirmed.plan).toBe(SubscriptionPlan.PRO);
      expect(confirmed.planLedger.deals).toHaveLength(2);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });
});

describe("CUSTOM plan channel top-up", () => {
  beforeAll(async () => {
    if (!databaseUrl) return;
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
    if (!databaseAvailable) return;

    const admin = await prisma.platformAdmin.create({
      data: {
        email: `top-up-admin-${uniqueSuffix()}@test.local`,
        passwordHash: await hash("password12345", 12),
        name: "Top-up Test Admin",
      },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.platformAdmin.delete({ where: { id: adminId } }).catch(() => {});
    }
    // Connection stays open for the next describe block in this file, which
    // does its own final $disconnect().
  });

  it("increases only the selected channel, leaving paidUntil/status/contactLimit/other channels unchanged", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      const { subscription: before } = await activatePlanDealDirectly({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.CUSTOM,
        amountPaise: 10_000_00,
        contactLimit: 5000,
        smsMonthlyLimit: 1000,
        whatsappMonthlyLimit: 500,
        emailMonthlyLimit: 200,
        durationDays: 30,
        createdByAdminId: adminId,
      });

      const { channelLimit, topUp } = await topUpCustomPlanChannel({
        organizationId: org.organization.id,
        channel: Channel.WHATSAPP,
        messagesAdded: 300,
        amountPaise: 1_000_00,
        createdByAdminId: adminId,
      });

      expect(channelLimit.channel).toBe(Channel.WHATSAPP);
      expect(channelLimit.monthlyLimit).toBe(800); // 500 + 300
      expect(topUp.resultingMonthlyLimit).toBe(800);
      expect(topUp.paymentStatus).toBe("UNPAID");

      const after = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });
      expect(after.paidUntil!.getTime()).toBe(before.paidUntil!.getTime());
      expect(after.status).toBe(before.status);
      expect(after.contactLimit).toBe(before.contactLimit);
      // Aggregate dual-write: grew by exactly the top-up amount.
      expect(after.monthlyMessageLimit).toBe(before.monthlyMessageLimit + 300);

      const limits = await prisma.channelMessageLimit.findMany({
        where: { subscriptionId: after.id },
      });
      const sms = limits.find((l) => l.channel === Channel.SMS)!;
      const email = limits.find((l) => l.channel === Channel.EMAIL)!;
      expect(sms.monthlyLimit).toBe(1000);
      expect(email.monthlyLimit).toBe(200);

      const ledger = await getPlanLedgerForOrganization(org.organization.id);
      expect(ledger.topUps).toHaveLength(1);
      expect(ledger.outstandingBalancePaise).toBe(10_000_00 + 1_000_00);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("seeds a legacy channel row at aggregate + messagesAdded, never smaller than the prior effective allocation", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      // Simulate a pre-existing CUSTOM org with no per-channel rows at all
      // (aggregate-only), the way orgs looked before per-channel limits shipped.
      const bounds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await prisma.subscription.update({
        where: { organizationId: org.organization.id },
        data: {
          plan: SubscriptionPlan.CUSTOM,
          status: SubscriptionStatus.ACTIVE,
          monthlyMessageLimit: 50_000,
          paidUntil: bounds,
        },
      });

      const { channelLimit } = await topUpCustomPlanChannel({
        organizationId: org.organization.id,
        channel: Channel.SMS,
        messagesAdded: 500,
        amountPaise: 200_00,
        createdByAdminId: adminId,
      });

      // Must NOT be seeded at just 500 -- that would shrink SMS's effective
      // quota from the 50,000-message aggregate pool it had access to.
      expect(channelLimit.monthlyLimit).toBe(50_000 + 500);
      expect(channelLimit.monthlyLimit).toBeGreaterThan(500);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("recordPlanPayment FIFO-allocates across a mix of one deal and one top-up, ordered by date", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      const { deal } = await activatePlanDealDirectly({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.CUSTOM,
        amountPaise: 5_000_00,
        contactLimit: 2000,
        smsMonthlyLimit: 1000,
        whatsappMonthlyLimit: 500,
        emailMonthlyLimit: 200,
        durationDays: 30,
        createdByAdminId: adminId,
      });
      const { topUp } = await topUpCustomPlanChannel({
        organizationId: org.organization.id,
        channel: Channel.WHATSAPP,
        messagesAdded: 300,
        amountPaise: 3_000_00,
        createdByAdminId: adminId,
      });

      // Pays the deal (older) in full + partially pays the top-up (newer).
      await recordPlanPayment(
        org.organization.id,
        5_000_00 + 1_000_00,
        "Mixed settlement",
        adminId,
      );

      const ledger = await getPlanLedgerForOrganization(org.organization.id);
      const paidDeal = ledger.deals.find((d) => d.id === deal.id)!;
      const partialTopUp = ledger.topUps.find((t) => t.id === topUp.id)!;

      expect(paidDeal.paymentStatus).toBe("PAID");
      expect(paidDeal.amountPaidPaise).toBe(5_000_00);
      expect(partialTopUp.paymentStatus).toBe("PARTIALLY_PAID");
      expect(partialTopUp.amountPaidPaise).toBe(1_000_00);
      expect(ledger.outstandingBalancePaise).toBe(3_000_00 - 1_000_00);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("rejects a top-up for a non-CUSTOM organization", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      await expect(
        topUpCustomPlanChannel({
          organizationId: org.organization.id,
          channel: Channel.SMS,
          messagesAdded: 100,
          amountPaise: 100_00,
          createdByAdminId: adminId,
        }),
      ).rejects.toThrow(PlanLedgerError);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("rejects a top-up for a PAST_DUE CUSTOM subscription", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      await activatePlanDealDirectly({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.CUSTOM,
        amountPaise: 5_000_00,
        contactLimit: 2000,
        smsMonthlyLimit: 1000,
        whatsappMonthlyLimit: 500,
        emailMonthlyLimit: 200,
        durationDays: 30,
        createdByAdminId: adminId,
      });
      await prisma.subscription.update({
        where: { organizationId: org.organization.id },
        data: { status: SubscriptionStatus.PAST_DUE },
      });

      await expect(
        topUpCustomPlanChannel({
          organizationId: org.organization.id,
          channel: Channel.SMS,
          messagesAdded: 100,
          amountPaise: 100_00,
          createdByAdminId: adminId,
        }),
      ).rejects.toThrow(PlanLedgerError);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("rejects a top-up for an expired CUSTOM subscription", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      await activatePlanDealDirectly({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.CUSTOM,
        amountPaise: 5_000_00,
        contactLimit: 2000,
        smsMonthlyLimit: 1000,
        whatsappMonthlyLimit: 500,
        emailMonthlyLimit: 200,
        durationDays: 30,
        createdByAdminId: adminId,
      });
      await prisma.subscription.update({
        where: { organizationId: org.organization.id },
        data: { paidUntil: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      await expect(
        topUpCustomPlanChannel({
          organizationId: org.organization.id,
          channel: Channel.SMS,
          messagesAdded: 100,
          amountPaise: 100_00,
          createdByAdminId: adminId,
        }),
      ).rejects.toThrow(PlanLedgerError);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });
});

describe("STARTER/PRO direct activation (unified plan-deal ledger)", () => {
  beforeAll(async () => {
    if (!databaseUrl) return;
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
    if (!databaseAvailable) return;

    const admin = await prisma.platformAdmin.create({
      data: {
        email: `starter-pro-activation-admin-${uniqueSuffix()}@test.local`,
        passwordHash: await hash("password12345", 12),
        name: "Starter Pro Activation Test Admin",
      },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.platformAdmin.delete({ where: { id: adminId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("activates STARTER directly using catalogue defaults: PlanDeal.plan=STARTER, aggregate monthlyMessageLimit set, channel fields null, no ChannelMessageLimit rows", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const catalogue = await getPlanCatalogueEntry(SubscriptionPlan.STARTER);
    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      const { subscription, deal } = await activatePlanDealDirectly({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.STARTER,
        durationDays: 30,
        createdByAdminId: adminId,
      });

      expect(subscription.plan).toBe(SubscriptionPlan.STARTER);
      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.contactLimit).toBe(catalogue.contactLimit);
      expect(subscription.monthlyMessageLimit).toBe(catalogue.monthlyMessageLimit);

      expect(deal.plan).toBe(SubscriptionPlan.STARTER);
      expect(deal.amountDuePaise).toBe(catalogue.amountPaise);
      expect(deal.paymentStatus).toBe("UNPAID");
      expect(deal.monthlyMessageLimit).toBe(catalogue.monthlyMessageLimit);
      expect(deal.smsMonthlyLimit).toBeNull();
      expect(deal.whatsappMonthlyLimit).toBeNull();
      expect(deal.emailMonthlyLimit).toBeNull();

      const channelLimits = await prisma.channelMessageLimit.findMany({
        where: { subscriptionId: subscription.id },
      });
      expect(channelLimits).toHaveLength(0);

      const ledger = await getPlanLedgerForOrganization(org.organization.id);
      expect(ledger.outstandingBalancePaise).toBe(catalogue.amountPaise);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("activates PRO directly with an admin-entered contactLimit override, still using the catalogue price/message limit", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const catalogue = await getPlanCatalogueEntry(SubscriptionPlan.PRO);
    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      const { subscription, deal } = await activatePlanDealDirectly({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.PRO,
        contactLimit: catalogue.contactLimit + 12_345,
        durationDays: 30,
        createdByAdminId: adminId,
      });

      expect(subscription.contactLimit).toBe(catalogue.contactLimit + 12_345);
      expect(subscription.monthlyMessageLimit).toBe(catalogue.monthlyMessageLimit);
      expect(deal.contactLimit).toBe(catalogue.contactLimit + 12_345);
      expect(deal.amountDuePaise).toBe(catalogue.amountPaise);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("recordPlanPayment FIFO-allocates across a mix of a STARTER deal, a CUSTOM deal, and a CUSTOM top-up, ordered by date", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    try {
      const { deal: starterDeal } = await activatePlanDealDirectly({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.STARTER,
        durationDays: 30,
        createdByAdminId: adminId,
      });

      const { deal: customDeal } = await activatePlanDealDirectly({
        organizationId: org.organization.id,
        plan: SubscriptionPlan.CUSTOM,
        amountPaise: 5_000_00,
        contactLimit: 2000,
        smsMonthlyLimit: 1000,
        whatsappMonthlyLimit: 500,
        emailMonthlyLimit: 200,
        durationDays: 30,
        createdByAdminId: adminId,
      });

      const { topUp } = await topUpCustomPlanChannel({
        organizationId: org.organization.id,
        channel: Channel.WHATSAPP,
        messagesAdded: 100,
        amountPaise: 1_000_00,
        createdByAdminId: adminId,
      });

      const totalOwed =
        starterDeal.amountDuePaise + customDeal.amountDuePaise + topUp.amountDuePaise;

      // Pay everything in full in one payment; FIFO order doesn't matter for
      // the final state, but every item across all three plans/kinds must
      // end up settled by the single unified ledger.
      await recordPlanPayment(org.organization.id, totalOwed, "Full settlement", adminId);

      const ledger = await getPlanLedgerForOrganization(org.organization.id);
      const paidStarterDeal = ledger.deals.find((d) => d.id === starterDeal.id)!;
      const paidCustomDeal = ledger.deals.find((d) => d.id === customDeal.id)!;
      const paidTopUp = ledger.topUps.find((t) => t.id === topUp.id)!;

      expect(paidStarterDeal.paymentStatus).toBe("PAID");
      expect(paidCustomDeal.paymentStatus).toBe("PAID");
      expect(paidTopUp.paymentStatus).toBe("PAID");
      expect(ledger.outstandingBalancePaise).toBe(0);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });
});
