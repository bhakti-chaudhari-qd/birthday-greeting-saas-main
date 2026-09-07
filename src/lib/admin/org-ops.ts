import {
  Channel,
  DeliveryStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";
import { z } from "zod";

import { sendPasswordResetForUser } from "@/lib/auth/email-flows";
import {
  adminPasswordResetThrottleKey,
  recordAdminPasswordReset,
} from "@/lib/auth/rate-limit";
import { activatePlanDealDirectly } from "@/lib/billing/apply-plan";
import {
  getPlanLedgerForOrganization,
  recordPlanPayment,
  topUpCustomPlanChannel,
  type PlanLedger,
} from "@/lib/billing/plan-ledger";
import {
  ActivePlanRenewalConfirmationRequiredError,
  listAdminPaymentLinksForOrganization,
  type AdminPaymentLinkSummary,
} from "@/lib/billing/service";
import { prisma } from "@/lib/db";

import {
  PLATFORM_ADMIN_AUDIT_ACTIONS,
  createPlatformAdminAuditEvent,
  type PlatformAdminAuditValues,
} from "./audit";
import {
  getOrganizationSummaryForPlatformAdmin,
  listOrganizationsForPlatformAdmin,
  type PlatformOrganizationSummary,
} from "./organizations";

export class PlatformAdminOrgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformAdminOrgError";
  }
}

export class PlatformAdminOrgInactiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformAdminOrgInactiveError";
  }
}

export type PlatformOrganizationUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export type PlatformOrganizationDetail = PlatformOrganizationSummary & {
  users: PlatformOrganizationUser[];
  planLedger: PlanLedger;
  paymentLinks: AdminPaymentLinkSummary[];
};

export async function getOrganizationForPlatformAdmin(
  organizationId: string,
): Promise<PlatformOrganizationDetail | null> {
  const [organization, users, planLedger, paymentLinks] =
    await Promise.all([
      getOrganizationSummaryForPlatformAdmin(organizationId),
      prisma.user.findMany({
        where: { organizationId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      getPlanLedgerForOrganization(organizationId),
      listAdminPaymentLinksForOrganization(organizationId),
    ]);

  if (!organization) {
    return null;
  }

  return {
    ...organization,
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    })),
    planLedger,
    paymentLinks,
  };
}

export const updatePlatformOrganizationSchema = z
  .object({
    isActive: z.boolean().optional(),
    liveChannelsApproved: z.boolean().optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .refine(
    (value) => Object.values(value).some((entry) => entry !== undefined),
    { message: "At least one field is required" },
  );

export const createOrganizationPaymentLinkSchema = z
  .object({
    plan: z.nativeEnum(SubscriptionPlan),
    amountPaise: z.number().int().min(100).max(10_000_000_00).optional(),
    contactLimit: z.number().int().min(1).max(1_000_000).optional(),
    /**
     * CUSTOM plans allocate messages per channel; smsMonthlyLimit /
     * whatsappMonthlyLimit / emailMonthlyLimit are required instead and the
     * aggregate monthlyMessageLimit is derived server-side as their sum.
     */
    smsMonthlyLimit: z.number().int().min(0).max(10_000_000).optional(),
    whatsappMonthlyLimit: z.number().int().min(0).max(10_000_000).optional(),
    emailMonthlyLimit: z.number().int().min(0).max(10_000_000).optional(),
    durationDays: z.number().int().min(1).max(366).optional(),
    customerEmail: z.string().trim().email().max(255).optional(),
    /** Required when the org already has an active, unexpired non-FREE plan. */
    confirmRenewal: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.plan === SubscriptionPlan.FREE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "FREE cannot be sold via payment link",
        path: ["plan"],
      });
    }
    if (value.plan === SubscriptionPlan.CUSTOM) {
      if (value.amountPaise == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "amountPaise is required for CUSTOM",
          path: ["amountPaise"],
        });
      }
      if (value.contactLimit == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "contactLimit is required for CUSTOM",
          path: ["contactLimit"],
        });
      }
      if (
        value.smsMonthlyLimit == null ||
        value.whatsappMonthlyLimit == null ||
        value.emailMonthlyLimit == null
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "smsMonthlyLimit, whatsappMonthlyLimit, and emailMonthlyLimit are required for CUSTOM",
          path: ["smsMonthlyLimit"],
        });
      } else if (
        value.smsMonthlyLimit + value.whatsappMonthlyLimit + value.emailMonthlyLimit <=
        0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one channel must have a limit greater than zero",
          path: ["smsMonthlyLimit"],
        });
      }
    }
  });

/**
 * Activates a plan deal (STARTER/PRO/CUSTOM) directly, without payment.
 * CUSTOM requires amountPaise/contactLimit and at least one channel limit
 * greater than zero; STARTER/PRO leave all of those optional (they default to
 * the (editable) plan catalogue) but only accept STARTER/PRO/CUSTOM plans.
 */
export const activatePlanDealSchema = z
  .object({
    plan: z.nativeEnum(SubscriptionPlan),
    amountPaise: z.number().int().min(1).max(10_000_000_00).optional(),
    contactLimit: z.number().int().min(1).max(1_000_000).optional(),
    smsMonthlyLimit: z.number().int().min(0).max(10_000_000).optional(),
    whatsappMonthlyLimit: z.number().int().min(0).max(10_000_000).optional(),
    emailMonthlyLimit: z.number().int().min(0).max(10_000_000).optional(),
    durationDays: z.number().int().min(1).max(366).optional(),
    /** Required when the org already has an active, unexpired non-FREE plan. */
    confirmRenewal: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.plan !== SubscriptionPlan.STARTER &&
      value.plan !== SubscriptionPlan.PRO &&
      value.plan !== SubscriptionPlan.CUSTOM
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only STARTER, PRO, or CUSTOM plans can be activated",
        path: ["plan"],
      });
      return;
    }

    if (value.plan === SubscriptionPlan.CUSTOM) {
      if (value.amountPaise == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "amountPaise is required for CUSTOM",
          path: ["amountPaise"],
        });
      }
      if (value.contactLimit == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "contactLimit is required for CUSTOM",
          path: ["contactLimit"],
        });
      }
      const total =
        (value.smsMonthlyLimit ?? 0) +
        (value.whatsappMonthlyLimit ?? 0) +
        (value.emailMonthlyLimit ?? 0);
      if (total <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one channel must have a limit greater than zero",
          path: ["smsMonthlyLimit"],
        });
      }
    }
  });

export const recordPlanPaymentSchema = z.object({
  amountPaise: z.number().int().min(1).max(10_000_000_00),
  note: z.string().trim().max(500).optional(),
});

/**
 * Increases one channel's ceiling for the org's current CUSTOM period. Not a
 * deal/renewal: never touches paidUntil, contactLimit, or the other channels.
 */
export const topUpCustomPlanChannelSchema = z.object({
  channel: z.nativeEnum(Channel),
  messagesAdded: z.number().int().min(1).max(10_000_000),
  amountPaise: z.number().int().min(0).max(10_000_000_00),
});

export type UpdatePlatformOrganizationInput = z.infer<
  typeof updatePlatformOrganizationSchema
>;
export type CreateOrganizationPaymentLinkInput = z.infer<
  typeof createOrganizationPaymentLinkSchema
>;
export type ActivatePlanDealInput = z.infer<typeof activatePlanDealSchema>;
export type RecordPlanPaymentInput = z.infer<typeof recordPlanPaymentSchema>;
export type TopUpCustomPlanChannelInput = z.infer<
  typeof topUpCustomPlanChannelSchema
>;

export async function updateOrganizationForPlatformAdmin(
  organizationId: string,
  input: UpdatePlatformOrganizationInput,
  actorAdminId: string,
): Promise<PlatformOrganizationDetail> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.organization.findUnique({
      where: { id: organizationId },
      include: { subscription: true },
    });

    if (!existing) {
      throw new PlatformAdminOrgError("Organization not found");
    }

    const before: PlatformAdminAuditValues = {};
    const after: PlatformAdminAuditValues = {};
    const changedFields: string[] = [];

    const recordChange = (
      field: keyof PlatformAdminAuditValues,
      previous: string | number | boolean | null,
      next: string | number | boolean | null | undefined,
    ) => {
      if (next === undefined || previous === next) return;
      before[field] = previous as never;
      after[field] = next as never;
      changedFields.push(field);
    };

    recordChange("isActive", existing.isActive, input.isActive);
    recordChange(
      "liveChannelsApproved",
      existing.liveChannelsApproved,
      input.liveChannelsApproved,
    );
    recordChange("timezone", existing.timezone, input.timezone);

    const organizationChanged = changedFields.some((field) =>
      ["isActive", "timezone", "liveChannelsApproved"].includes(field),
    );
    if (organizationChanged) {
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          ...(after.isActive !== undefined
            ? { isActive: after.isActive }
            : {}),
          ...(after.timezone !== undefined ? { timezone: after.timezone } : {}),
          ...(after.liveChannelsApproved !== undefined
            ? { liveChannelsApproved: input.liveChannelsApproved }
            : {}),
        },
      });
    }

    if (changedFields.length > 0) {
      await createPlatformAdminAuditEvent(
        {
          actorAdminId,
          organizationId,
          action: PLATFORM_ADMIN_AUDIT_ACTIONS.ORGANIZATION_UPDATED,
          targetType: "organization",
          targetId: organizationId,
          before,
          after,
          metadata: { changedFields },
        },
        tx,
      );
    }
  });

  const updated = await getOrganizationForPlatformAdmin(organizationId);
  if (!updated) {
    throw new PlatformAdminOrgError("Organization not found after update");
  }
  return updated;
}

/** Activates (or renews) a STARTER/PRO/CUSTOM plan deal immediately, independent of payment. */
export async function activatePlanForPlatformAdmin(
  organizationId: string,
  input: ActivatePlanDealInput,
  actorAdminId: string,
): Promise<PlatformOrganizationDetail> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      subscription: {
        select: { plan: true, status: true, paidUntil: true },
      },
    },
  });
  if (!organization) {
    throw new PlatformAdminOrgError("Organization not found");
  }

  const existing = organization.subscription;
  const hasActiveUnexpiredPlan =
    existing != null &&
    existing.plan !== SubscriptionPlan.FREE &&
    existing.status === SubscriptionStatus.ACTIVE &&
    existing.paidUntil != null &&
    existing.paidUntil > new Date();

  if (hasActiveUnexpiredPlan && input.confirmRenewal !== true) {
    throw new ActivePlanRenewalConfirmationRequiredError(
      `This organization already has an active ${existing!.plan} plan until ${existing!.paidUntil!.toISOString()}. Pass confirmRenewal=true to acknowledge activating ${input.plan} for it.`,
    );
  }

  const { deal } = await activatePlanDealDirectly({
    organizationId,
    plan: input.plan,
    amountPaise: input.amountPaise,
    contactLimit: input.contactLimit,
    smsMonthlyLimit: input.smsMonthlyLimit,
    whatsappMonthlyLimit: input.whatsappMonthlyLimit,
    emailMonthlyLimit: input.emailMonthlyLimit,
    durationDays: input.durationDays,
    createdByAdminId: actorAdminId,
  });

  await createPlatformAdminAuditEvent({
    actorAdminId,
    organizationId,
    action: PLATFORM_ADMIN_AUDIT_ACTIONS.PLAN_ACTIVATED_DIRECT,
    targetType: "organization",
    targetId: organizationId,
    metadata: {
      dealId: deal.id,
      amountPaise: deal.amountDuePaise,
      plan: input.plan,
    },
  });

  const updated = await getOrganizationForPlatformAdmin(organizationId);
  if (!updated) {
    throw new PlatformAdminOrgError("Organization not found after activation");
  }
  return updated;
}

/** Records a payment against an org's outstanding plan-deal balance (FIFO across unpaid deals/top-ups). */
export async function recordPlanPaymentForPlatformAdmin(
  organizationId: string,
  input: RecordPlanPaymentInput,
  actorAdminId: string,
): Promise<PlatformOrganizationDetail> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!organization) {
    throw new PlatformAdminOrgError("Organization not found");
  }

  const payment = await recordPlanPayment(
    organizationId,
    input.amountPaise,
    input.note,
    actorAdminId,
  );

  await createPlatformAdminAuditEvent({
    actorAdminId,
    organizationId,
    action: PLATFORM_ADMIN_AUDIT_ACTIONS.PLAN_PAYMENT_RECORDED,
    targetType: "organization",
    targetId: organizationId,
    metadata: { paymentId: payment.id, amountPaise: input.amountPaise },
  });

  const updated = await getOrganizationForPlatformAdmin(organizationId);
  if (!updated) {
    throw new PlatformAdminOrgError("Organization not found after payment");
  }
  return updated;
}

/**
 * Increases one channel's ceiling for the org's current CUSTOM period. Not a
 * renewal: never touches paidUntil/status/contactLimit/other channels. See
 * topUpCustomPlanChannel for the domain rules (throws PlanLedgerError).
 */
export async function topUpCustomPlanChannelForPlatformAdmin(
  organizationId: string,
  input: TopUpCustomPlanChannelInput,
  actorAdminId: string,
): Promise<PlatformOrganizationDetail> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!organization) {
    throw new PlatformAdminOrgError("Organization not found");
  }

  const { topUp } = await topUpCustomPlanChannel({
    organizationId,
    channel: input.channel,
    messagesAdded: input.messagesAdded,
    amountPaise: input.amountPaise,
    createdByAdminId: actorAdminId,
  });

  await createPlatformAdminAuditEvent({
    actorAdminId,
    organizationId,
    action: PLATFORM_ADMIN_AUDIT_ACTIONS.CUSTOM_PLAN_CHANNEL_TOPPED_UP,
    targetType: "organization",
    targetId: organizationId,
    metadata: {
      channel: input.channel,
      messagesAdded: input.messagesAdded,
      amountPaise: input.amountPaise,
      resultingMonthlyLimit: topUp.resultingMonthlyLimit,
    },
  });

  const updated = await getOrganizationForPlatformAdmin(organizationId);
  if (!updated) {
    throw new PlatformAdminOrgError("Organization not found after top-up");
  }
  return updated;
}

export async function setOrganizationUserActiveForPlatformAdmin(input: {
  actorAdminId: string;
  organizationId: string;
  userId: string;
  isActive: boolean;
}): Promise<PlatformOrganizationUser> {
  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: {
        id: input.userId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new PlatformAdminOrgError("User not found in this organization");
    }

    if (user.isActive === input.isActive) {
      return user;
    }

    const changedUser = await tx.user.update({
      where: { id: user.id },
      data: { isActive: input.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await createPlatformAdminAuditEvent(
      {
        actorAdminId: input.actorAdminId,
        organizationId: input.organizationId,
        action: input.isActive
          ? PLATFORM_ADMIN_AUDIT_ACTIONS.USER_ACTIVATED
          : PLATFORM_ADMIN_AUDIT_ACTIONS.USER_DEACTIVATED,
        targetType: "organization_user",
        targetId: user.id,
        before: { isActive: user.isActive },
        after: { isActive: input.isActive },
      },
      tx,
    );

    return changedUser;
  });

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    isActive: updated.isActive,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function sendOrganizationUserPasswordResetForPlatformAdmin(input: {
  adminId: string;
  organizationId: string;
  userId: string;
}): Promise<void> {
  const user = await prisma.user.findFirst({
    where: {
      id: input.userId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      email: true,
      isActive: true,
      organization: {
        select: { isActive: true },
      },
    },
  });

  if (!user) {
    throw new PlatformAdminOrgError("User not found in this organization");
  }

  if (!user.organization.isActive) {
    throw new PlatformAdminOrgInactiveError("Organization is inactive");
  }

  if (!user.isActive) {
    throw new PlatformAdminOrgInactiveError("User is inactive");
  }

  await recordAdminPasswordReset(
    adminPasswordResetThrottleKey(input.adminId, user.id),
  );
  await createPlatformAdminAuditEvent({
    actorAdminId: input.adminId,
    organizationId: input.organizationId,
    action: PLATFORM_ADMIN_AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
    targetType: "organization_user",
    targetId: user.id,
  });
  await sendPasswordResetForUser({ id: user.id, email: user.email });
}

const SUCCESS_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.SENT,
  DeliveryStatus.DELIVERED,
  DeliveryStatus.READ,
];

const FAILURE_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.FAILED,
  DeliveryStatus.UNDELIVERED,
];

function startOfUtcDay(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export type PlatformUsageSnapshot = {
  deliveriesToday: number;
  deliveriesThisMonth: number;
  successCount: number;
  failureCount: number;
  successRatePercent: number | null;
  statusBreakdown: Array<{ status: DeliveryStatus; count: number }>;
  channelBreakdown: Array<{ channel: string; count: number }>;
  queuePending: number;
  queueSending: number;
  queueFailed: number;
  nearContactLimit: PlatformOrganizationSummary[];
  nearMessageLimit: PlatformOrganizationSummary[];
};

export async function getPlatformUsageSnapshot(): Promise<PlatformUsageSnapshot> {
  const monthStart = startOfUtcMonth();
  const dayStart = startOfUtcDay();

  const [
    monthlyLogs,
    deliveriesToday,
    queuePending,
    queueSending,
    queueFailed,
    organizations,
  ] = await Promise.all([
    prisma.deliveryLog.findMany({
      where: { createdAt: { gte: monthStart } },
      select: {
        status: true,
        sendQueue: { select: { channel: true } },
      },
    }),
    prisma.deliveryLog.count({
      where: { createdAt: { gte: dayStart } },
    }),
    prisma.sendQueue.count({ where: { status: "PENDING" } }),
    prisma.sendQueue.count({ where: { status: "SENDING" } }),
    prisma.sendQueue.count({ where: { status: "FAILED" } }),
    listOrganizationsForPlatformAdmin(),
  ]);

  const statusCountMap = new Map<DeliveryStatus, number>();
  const channelCountMap = new Map<string, number>();
  let successCount = 0;
  let failureCount = 0;

  for (const log of monthlyLogs) {
    statusCountMap.set(log.status, (statusCountMap.get(log.status) ?? 0) + 1);
    channelCountMap.set(
      log.sendQueue.channel,
      (channelCountMap.get(log.sendQueue.channel) ?? 0) + 1,
    );
    if (SUCCESS_STATUSES.includes(log.status)) {
      successCount += 1;
    }
    if (FAILURE_STATUSES.includes(log.status)) {
      failureCount += 1;
    }
  }

  const decided = successCount + failureCount;
  const summaries = organizations;

  const nearContactLimit = summaries
    .filter((org) => {
      if (org.contactLimit == null || org.contactLimit <= 0) return false;
      return org.contactCount / org.contactLimit >= 0.8;
    })
    .slice(0, 10);

  const nearMessageLimit = summaries
    .filter((org) => {
      if (
        org.monthlyMessageLimit == null ||
        org.monthlyMessageLimit <= 0 ||
        org.messagesSentThisMonth == null
      ) {
        return false;
      }
      return org.messagesSentThisMonth / org.monthlyMessageLimit >= 0.8;
    })
    .slice(0, 10);

  return {
    deliveriesToday,
    deliveriesThisMonth: monthlyLogs.length,
    successCount,
    failureCount,
    successRatePercent:
      decided === 0 ? null : Math.round((successCount / decided) * 1000) / 10,
    statusBreakdown: [...statusCountMap.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    channelBreakdown: [...channelCountMap.entries()]
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count),
    queuePending,
    queueSending,
    queueFailed,
    nearContactLimit,
    nearMessageLimit,
  };
}
