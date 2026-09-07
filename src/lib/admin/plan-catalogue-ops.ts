import { SubscriptionPlan, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { prisma as defaultPrisma } from "@/lib/db";

import {
  PLATFORM_ADMIN_AUDIT_ACTIONS,
  createPlatformAdminAuditEvent,
} from "./audit";

export class PlanCatalogueOpsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanCatalogueOpsError";
  }
}

export const updatePlanCatalogueEntrySchema = z.object({
  label: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(300),
  amountPaise: z.number().int().min(100).max(10_000_000_00),
  contactLimit: z.number().int().min(1).max(1_000_000),
  monthlyMessageLimit: z.number().int().min(1).max(10_000_000),
});

export type UpdatePlanCatalogueEntryInput = z.infer<
  typeof updatePlanCatalogueEntrySchema
>;

export type PlanCatalogueEntrySummary = {
  plan: SubscriptionPlan;
  label: string;
  description: string;
  amountPaise: number;
  contactLimit: number;
  monthlyMessageLimit: number;
  updatedAt: string;
  updatedByAdminName: string | null;
};

const EDITABLE_PLANS = [SubscriptionPlan.STARTER, SubscriptionPlan.PRO] as const;

function isEditablePlan(
  plan: string,
): plan is typeof SubscriptionPlan.STARTER | typeof SubscriptionPlan.PRO {
  return plan === SubscriptionPlan.STARTER || plan === SubscriptionPlan.PRO;
}

export async function listPlanCatalogueEntriesForPlatformAdmin(
  db: PrismaClient = defaultPrisma,
): Promise<PlanCatalogueEntrySummary[]> {
  const records = await db.planCatalogueRecord.findMany({
    where: { plan: { in: [...EDITABLE_PLANS] } },
    include: { updatedByAdmin: { select: { name: true } } },
  });

  const byPlan = new Map(records.map((record) => [record.plan, record]));

  return EDITABLE_PLANS.map((plan) => {
    const record = byPlan.get(plan);
    if (!record) {
      throw new PlanCatalogueOpsError(
        `Plan catalogue record missing for ${plan}`,
      );
    }
    return {
      plan: record.plan,
      label: record.label,
      description: record.description,
      amountPaise: record.amountPaise,
      contactLimit: record.contactLimit,
      monthlyMessageLimit: record.monthlyMessageLimit,
      updatedAt: record.updatedAt.toISOString(),
      updatedByAdminName: record.updatedByAdmin?.name ?? null,
    };
  });
}

export async function updatePlanCatalogueEntryForPlatformAdmin(
  plan: string,
  input: UpdatePlanCatalogueEntryInput,
  actorAdminId: string,
  db: PrismaClient = defaultPrisma,
): Promise<PlanCatalogueEntrySummary[]> {
  if (!isEditablePlan(plan)) {
    throw new PlanCatalogueOpsError(
      "Only STARTER and PRO plan entries can be edited",
    );
  }

  const before = await db.planCatalogueRecord.findUnique({ where: { plan } });
  if (!before) {
    throw new PlanCatalogueOpsError(`Plan catalogue record missing for ${plan}`);
  }

  await db.planCatalogueRecord.update({
    where: { plan },
    data: { ...input, updatedByAdminId: actorAdminId },
  });

  await createPlatformAdminAuditEvent(
    {
      actorAdminId,
      organizationId: null,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.PLAN_CATALOGUE_ENTRY_UPDATED,
      targetType: "plan_catalogue",
      targetId: plan,
      before: {
        label: before.label,
        description: before.description,
        amountPaise: before.amountPaise,
        contactLimit: before.contactLimit,
        monthlyMessageLimit: before.monthlyMessageLimit,
      },
      after: {
        label: input.label,
        description: input.description,
        amountPaise: input.amountPaise,
        contactLimit: input.contactLimit,
        monthlyMessageLimit: input.monthlyMessageLimit,
      },
    },
    db,
  );

  return listPlanCatalogueEntriesForPlatformAdmin(db);
}
