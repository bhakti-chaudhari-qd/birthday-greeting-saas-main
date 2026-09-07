import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import { SubscriptionPlan } from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { applyCheckoutPlanToOrganization } from "@/lib/billing/apply-plan";
import {
  PLAN_CATALOGUE,
  getPlanCatalogueEntry,
  listCheckoutPlans,
} from "@/lib/billing/catalogue";
import {
  PlanCatalogueOpsError,
  listPlanCatalogueEntriesForPlatformAdmin,
  updatePlanCatalogueEntryForPlatformAdmin,
} from "@/lib/admin/plan-catalogue-ops";
import { prisma } from "@/lib/db";
import { cleanupOrganization, uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;
let adminId: string;

function registerInput(suffix: string) {
  return {
    organizationName: `Catalogue Org ${suffix}`,
    organizationSlug: `catalogue-org-${suffix}`,
    timezone: "UTC",
    adminName: "Catalogue Admin",
    email: `catalogue-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

/** Restores a STARTER/PRO row to a known snapshot -- these rows are global singletons shared across the whole suite. */
async function restoreCatalogueEntry(
  plan: typeof SubscriptionPlan.STARTER | typeof SubscriptionPlan.PRO,
  snapshot: {
    label: string;
    description: string;
    amountPaise: number;
    contactLimit: number;
    monthlyMessageLimit: number;
  },
) {
  await prisma.planCatalogueRecord.update({
    where: { plan },
    data: { ...snapshot, updatedByAdminId: null },
  });
}

describe("editable STARTER/PRO plan catalogue", () => {
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
        email: `catalogue-platform-admin-${uniqueSuffix()}@test.local`,
        passwordHash: await hash("password12345", 12),
        name: "Catalogue Test Admin",
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

  it("exposes STARTER/PRO catalogue rows that reflect whatever is currently in the DB (defaults or a real admin edit)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    // These rows are a global singleton a real admin may have already edited
    // via the live UI, so this test sets a known snapshot itself rather than
    // assuming the DB still holds the hardcoded PLAN_CATALOGUE defaults.
    const starterBefore = await prisma.planCatalogueRecord.findUniqueOrThrow({
      where: { plan: SubscriptionPlan.STARTER },
    });
    const proBefore = await prisma.planCatalogueRecord.findUniqueOrThrow({
      where: { plan: SubscriptionPlan.PRO },
    });

    try {
      await restoreCatalogueEntry(SubscriptionPlan.STARTER, {
        label: PLAN_CATALOGUE.STARTER.label,
        description: PLAN_CATALOGUE.STARTER.description,
        amountPaise: PLAN_CATALOGUE.STARTER.amountPaise!,
        contactLimit: PLAN_CATALOGUE.STARTER.contactLimit,
        monthlyMessageLimit: PLAN_CATALOGUE.STARTER.monthlyMessageLimit,
      });
      await restoreCatalogueEntry(SubscriptionPlan.PRO, {
        label: PLAN_CATALOGUE.PRO.label,
        description: PLAN_CATALOGUE.PRO.description,
        amountPaise: PLAN_CATALOGUE.PRO.amountPaise!,
        contactLimit: PLAN_CATALOGUE.PRO.contactLimit,
        monthlyMessageLimit: PLAN_CATALOGUE.PRO.monthlyMessageLimit,
      });

      const entries = await listPlanCatalogueEntriesForPlatformAdmin();
      const starter = entries.find((e) => e.plan === SubscriptionPlan.STARTER)!;
      const pro = entries.find((e) => e.plan === SubscriptionPlan.PRO)!;

      expect(starter.amountPaise).toBe(PLAN_CATALOGUE.STARTER.amountPaise);
      expect(starter.contactLimit).toBe(PLAN_CATALOGUE.STARTER.contactLimit);
      expect(starter.monthlyMessageLimit).toBe(
        PLAN_CATALOGUE.STARTER.monthlyMessageLimit,
      );
      expect(pro.amountPaise).toBe(PLAN_CATALOGUE.PRO.amountPaise);
      expect(pro.contactLimit).toBe(PLAN_CATALOGUE.PRO.contactLimit);
      expect(pro.monthlyMessageLimit).toBe(PLAN_CATALOGUE.PRO.monthlyMessageLimit);
    } finally {
      await restoreCatalogueEntry(SubscriptionPlan.STARTER, starterBefore);
      await restoreCatalogueEntry(SubscriptionPlan.PRO, proBefore);
    }
  });

  it("updates only the targeted plan's fields, leaves the other plan untouched, and records an audit event", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const before = await prisma.planCatalogueRecord.findUniqueOrThrow({
      where: { plan: SubscriptionPlan.STARTER },
    });
    const proBefore = await prisma.planCatalogueRecord.findUniqueOrThrow({
      where: { plan: SubscriptionPlan.PRO },
    });

    try {
      const entries = await updatePlanCatalogueEntryForPlatformAdmin(
        SubscriptionPlan.STARTER,
        {
          label: "Starter Plus",
          description: "Updated description",
          amountPaise: 599_00,
          contactLimit: 1_500,
          monthlyMessageLimit: 12_000,
        },
        adminId,
      );

      const starter = entries.find((e) => e.plan === SubscriptionPlan.STARTER)!;
      const pro = entries.find((e) => e.plan === SubscriptionPlan.PRO)!;

      expect(starter.label).toBe("Starter Plus");
      expect(starter.description).toBe("Updated description");
      expect(starter.amountPaise).toBe(599_00);
      expect(starter.contactLimit).toBe(1_500);
      expect(starter.monthlyMessageLimit).toBe(12_000);
      expect(starter.updatedByAdminName).toBe("Catalogue Test Admin");

      expect(pro.amountPaise).toBe(proBefore.amountPaise);
      expect(pro.contactLimit).toBe(proBefore.contactLimit);
      expect(pro.monthlyMessageLimit).toBe(proBefore.monthlyMessageLimit);

      const auditEvent = await prisma.platformAdminAuditEvent.findFirst({
        where: {
          action: "PLAN_CATALOGUE_ENTRY_UPDATED",
          targetType: "plan_catalogue",
          targetId: SubscriptionPlan.STARTER,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(auditEvent).not.toBeNull();
      expect(auditEvent?.after).toMatchObject({
        label: "Starter Plus",
        amountPaise: 599_00,
      });
    } finally {
      await restoreCatalogueEntry(SubscriptionPlan.STARTER, before);
    }
  });

  it("rejects updating FREE or CUSTOM plans", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const input = {
      label: "Nope",
      description: "Nope",
      amountPaise: 100_00,
      contactLimit: 100,
      monthlyMessageLimit: 100,
    };

    await expect(
      updatePlanCatalogueEntryForPlatformAdmin(
        SubscriptionPlan.FREE,
        input,
        adminId,
      ),
    ).rejects.toThrow(PlanCatalogueOpsError);
    await expect(
      updatePlanCatalogueEntryForPlatformAdmin(
        SubscriptionPlan.CUSTOM,
        input,
        adminId,
      ),
    ).rejects.toThrow(PlanCatalogueOpsError);
  });

  it("getPlanCatalogueEntry/listCheckoutPlans immediately reflect an update", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const before = await prisma.planCatalogueRecord.findUniqueOrThrow({
      where: { plan: SubscriptionPlan.PRO },
    });

    try {
      await updatePlanCatalogueEntryForPlatformAdmin(
        SubscriptionPlan.PRO,
        {
          label: "Pro Max",
          description: "Updated",
          amountPaise: 1_999_00,
          contactLimit: 20_000,
          monthlyMessageLimit: 200_000,
        },
        adminId,
      );

      const entry = await getPlanCatalogueEntry(SubscriptionPlan.PRO);
      expect(entry.amountPaise).toBe(1_999_00);
      expect(entry.contactLimit).toBe(20_000);

      const [, pro] = await listCheckoutPlans();
      expect(pro.amountPaise).toBe(1_999_00);
      expect(pro.monthlyMessageLimit).toBe(200_000);
    } finally {
      await restoreCatalogueEntry(SubscriptionPlan.PRO, before);
    }
  });

  it("is future-only: an already-provisioned org keeps its old limits after a catalogue edit, while a later checkout picks up the new values", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const before = await prisma.planCatalogueRecord.findUniqueOrThrow({
      where: { plan: SubscriptionPlan.STARTER },
    });

    const existingOrg = await createRegisteredOrganization(
      registerInput(uniqueSuffix()),
    );
    let newOrg: Awaited<ReturnType<typeof createRegisteredOrganization>> | null =
      null;

    try {
      await applyCheckoutPlanToOrganization(
        existingOrg.organization.id,
        SubscriptionPlan.STARTER,
      );
      const existingSubBefore = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: existingOrg.organization.id },
      });
      expect(existingSubBefore.contactLimit).toBe(before.contactLimit);
      expect(existingSubBefore.monthlyMessageLimit).toBe(
        before.monthlyMessageLimit,
      );

      await updatePlanCatalogueEntryForPlatformAdmin(
        SubscriptionPlan.STARTER,
        {
          label: before.label,
          description: before.description,
          amountPaise: before.amountPaise,
          contactLimit: before.contactLimit + 5_000,
          monthlyMessageLimit: before.monthlyMessageLimit + 50_000,
        },
        adminId,
      );

      const existingSubAfter = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: existingOrg.organization.id },
      });
      expect(existingSubAfter.contactLimit).toBe(before.contactLimit);
      expect(existingSubAfter.monthlyMessageLimit).toBe(
        before.monthlyMessageLimit,
      );

      newOrg = await createRegisteredOrganization(registerInput(uniqueSuffix()));
      await applyCheckoutPlanToOrganization(
        newOrg.organization.id,
        SubscriptionPlan.STARTER,
      );
      const newSub = await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: newOrg.organization.id },
      });
      expect(newSub.contactLimit).toBe(before.contactLimit + 5_000);
      expect(newSub.monthlyMessageLimit).toBe(before.monthlyMessageLimit + 50_000);
    } finally {
      await restoreCatalogueEntry(SubscriptionPlan.STARTER, before);
      await cleanupOrganization(existingOrg.organization.id);
      if (newOrg) {
        await cleanupOrganization(newOrg.organization.id);
      }
    }
  });
});
