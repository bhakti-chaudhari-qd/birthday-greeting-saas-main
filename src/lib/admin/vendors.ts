import {
  DeliveryStatus,
  Prisma,
  VendorOnboardingStatus,
  VendorRegistrationInviteDeliveryStatus,
} from "@prisma/client";
import { z } from "zod";

import {
  isValidReferralCodeFormat,
  normalizeReferralCode,
} from "@/lib/auth/vendor-referral";
import {
  DELIVERY_FAILURE_STATUSES,
  DELIVERY_SUCCESS_STATUSES,
} from "@/lib/admin/organization-health";
import { prisma } from "@/lib/db";
import { startOfIstMonth } from "@/lib/queue/dates";

import {
  PLATFORM_ADMIN_AUDIT_ACTIONS,
  createPlatformAdminAuditEvent,
  type PlatformAdminAuditValues,
} from "./audit";

export class PlatformAdminVendorError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT" | "VALIDATION" = "VALIDATION",
  ) {
    super(message);
    this.name = "PlatformAdminVendorError";
  }
}

export type PlatformVendorSummary = {
  id: string;
  name: string;
  slug: string;
  mobile: string | null;
  referralCode: string;
  onboardingStatus: VendorOnboardingStatus;
  isActive: boolean;
  createdAt: string;
  registrationSubmittedAt: string | null;
  latestInvite: {
    deliveryStatus: VendorRegistrationInviteDeliveryStatus;
    sentAt: string | null;
    expiresAt: string;
    revokedAt: string | null;
    /** Specific reason for a FAILED/AMBIGUOUS outcome (see safeDeliveryError in vendor-invites.ts). */
    deliveryError: string | null;
  } | null;
  userCount: number;
  referredOrganizationCount: number;
  currentActiveConnectedOrganizationCount: number;
  currentRoutedDeliveriesThisMonth: number;
  currentRoutedMonthlyDeliverySuccessCount: number;
  currentRoutedMonthlyDeliveryFailureCount: number;
  currentRoutedMonthlyDeliverySuccessRatePercent: number | null;
};

export type PlatformVendorDetail = PlatformVendorSummary;

export const updatePlatformVendorSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  referralCode: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .refine(isValidReferralCodeFormat, {
      message:
        "Referral code must be 2-32 characters: letters, numbers, and hyphens",
    })
    .optional(),
  isActive: z.boolean().optional(),
});

export type UpdatePlatformVendorInput = z.infer<
  typeof updatePlatformVendorSchema
>;

async function loadVendorsForPlatformAdmin(
  vendorId?: string,
): Promise<PlatformVendorSummary[]> {
  const vendors = await prisma.vendor.findMany({
    where: vendorId ? { id: vendorId } : undefined,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      channelConfigs: {
        where: { isActive: true },
        select: { organizationId: true, channel: true },
      },
      registrationInvites: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          deliveryStatus: true,
          sentAt: true,
          expiresAt: true,
          revokedAt: true,
          deliveryError: true,
        },
      },
      _count: {
        select: {
          users: true,
          referredOrganizations: true,
        },
      },
    },
  });

  const vendorByRoute = new Map<string, string>();
  for (const vendor of vendors) {
    for (const config of vendor.channelConfigs) {
      vendorByRoute.set(
        `${config.organizationId}:${config.channel}`,
        vendor.id,
      );
    }
  }

  const monthlyLogs =
    vendorByRoute.size === 0
      ? []
      : await prisma.deliveryLog.findMany({
          where: {
            createdAt: { gte: startOfIstMonth() },
            OR: vendors.flatMap((vendor) =>
              vendor.channelConfigs.map((config) => ({
                organizationId: config.organizationId,
                sendQueue: { channel: config.channel },
              })),
            ),
          },
          select: {
            organizationId: true,
            status: true,
            sendQueue: { select: { channel: true } },
          },
        });

  const deliveryRowsByVendor = new Map<string, DeliveryStatus[]>();
  for (const log of monthlyLogs) {
    const routedVendorId = vendorByRoute.get(
      `${log.organizationId}:${log.sendQueue.channel}`,
    );
    if (!routedVendorId) continue;
    const rows = deliveryRowsByVendor.get(routedVendorId) ?? [];
    rows.push(log.status);
    deliveryRowsByVendor.set(routedVendorId, rows);
  }

  return vendors.map((vendor) => {
    const latestInvite = vendor.registrationInvites?.[0] ?? null;
    const statuses = deliveryRowsByVendor.get(vendor.id) ?? [];
    const monthlyDeliverySuccessCount = statuses.filter((status) =>
      DELIVERY_SUCCESS_STATUSES.has(status),
    ).length;
    const monthlyDeliveryFailureCount = statuses.filter((status) =>
      DELIVERY_FAILURE_STATUSES.has(status),
    ).length;
    const decided =
      monthlyDeliverySuccessCount + monthlyDeliveryFailureCount;

    return {
      id: vendor.id,
      name: vendor.name,
      slug: vendor.slug,
      mobile: vendor.mobile,
      referralCode: vendor.referralCode,
      onboardingStatus: vendor.onboardingStatus,
      isActive: vendor.isActive,
      createdAt: vendor.createdAt.toISOString(),
      registrationSubmittedAt:
        vendor.registrationSubmittedAt?.toISOString() ?? null,
      latestInvite: latestInvite
        ? {
            deliveryStatus: latestInvite.deliveryStatus,
            sentAt: latestInvite.sentAt?.toISOString() ?? null,
            expiresAt: latestInvite.expiresAt.toISOString(),
            revokedAt: latestInvite.revokedAt?.toISOString() ?? null,
            deliveryError: latestInvite.deliveryError,
          }
        : null,
      userCount: vendor._count.users,
      referredOrganizationCount: vendor._count.referredOrganizations,
      currentActiveConnectedOrganizationCount: new Set(
        vendor.channelConfigs.map((config) => config.organizationId),
      ).size,
      // DeliveryLog does not retain vendor attribution. These metrics
      // intentionally describe logs matching the vendor's current active
      // organization/channel routes, not historical vendor ownership.
      currentRoutedDeliveriesThisMonth: statuses.length,
      currentRoutedMonthlyDeliverySuccessCount: monthlyDeliverySuccessCount,
      currentRoutedMonthlyDeliveryFailureCount: monthlyDeliveryFailureCount,
      currentRoutedMonthlyDeliverySuccessRatePercent:
        decided === 0
          ? null
          : Math.round(
              (monthlyDeliverySuccessCount / decided) * 1000,
            ) / 10,
    };
  });
}

export function listVendorsForPlatformAdmin() {
  return loadVendorsForPlatformAdmin();
}

export async function getVendorForPlatformAdmin(
  vendorId: string,
): Promise<PlatformVendorDetail | null> {
  const vendors = await loadVendorsForPlatformAdmin(vendorId);
  return vendors[0] ?? null;
}

export async function updateVendorForPlatformAdmin(
  vendorId: string,
  input: UpdatePlatformVendorInput,
  actorAdminId: string,
): Promise<PlatformVendorDetail> {
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.vendor.findUnique({
        where: { id: vendorId },
        select: {
          id: true,
          name: true,
          referralCode: true,
          isActive: true,
          onboardingStatus: true,
        },
      });

      if (!existing) {
        throw new PlatformAdminVendorError("Vendor not found", "NOT_FOUND");
      }

      const normalizedReferralCode =
        input.referralCode === undefined
          ? undefined
          : normalizeReferralCode(input.referralCode);
      const before: PlatformAdminAuditValues = {};
      const after: PlatformAdminAuditValues = {};
      const data: Prisma.VendorUpdateInput = {};
      const changedFields: string[] = [];

      if (
        input.isActive !== undefined &&
        input.isActive !== existing.isActive &&
        existing.onboardingStatus !== VendorOnboardingStatus.APPROVED
      ) {
        throw new PlatformAdminVendorError(
          "Only approved vendors can be suspended or reactivated",
          "VALIDATION",
        );
      }

      if (input.name !== undefined && input.name !== existing.name) {
        before.name = existing.name;
        after.name = input.name;
        data.name = input.name;
        changedFields.push("name");
      }
      if (
        input.isActive !== undefined &&
        input.isActive !== existing.isActive
      ) {
        before.isActive = existing.isActive;
        after.isActive = input.isActive;
        data.isActive = input.isActive;
        changedFields.push("isActive");
      }
      if (
        normalizedReferralCode !== undefined &&
        normalizedReferralCode !== existing.referralCode
      ) {
        before.referralCode = existing.referralCode;
        after.referralCode = normalizedReferralCode;
        data.referralCode = normalizedReferralCode;
        changedFields.push("referralCode");
      }

      if (changedFields.length === 0) return;

      await tx.vendor.update({
        where: { id: vendorId },
        data,
      });
      if (
        existing.onboardingStatus === VendorOnboardingStatus.APPROVED &&
        existing.isActive &&
        input.isActive === false
      ) {
        await tx.vendorSession.deleteMany({ where: { vendorId } });
      }
      await createPlatformAdminAuditEvent(
        {
          actorAdminId,
          action: PLATFORM_ADMIN_AUDIT_ACTIONS.VENDOR_UPDATED,
          targetType: "vendor",
          targetId: vendorId,
          before,
          after,
          metadata: { changedFields },
        },
        tx,
      );
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new PlatformAdminVendorError(
        "That referral code is already in use",
        "CONFLICT",
      );
    }
    throw error;
  }

  const updated = await getVendorForPlatformAdmin(vendorId);
  if (!updated) {
    throw new PlatformAdminVendorError("Vendor not found after update", "NOT_FOUND");
  }

  return updated;
}

async function transitionPendingVendor(
  vendorId: string,
  actorAdminId: string,
  nextStatus:
    | typeof VendorOnboardingStatus.APPROVED
    | typeof VendorOnboardingStatus.REJECTED,
): Promise<PlatformVendorDetail> {
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const result = await tx.vendor.updateMany({
      where: {
        id: vendorId,
        onboardingStatus: VendorOnboardingStatus.PENDING,
      },
      data:
        nextStatus === VendorOnboardingStatus.APPROVED
          ? {
              onboardingStatus: nextStatus,
              approvedAt: now,
              approvedByAdminId: actorAdminId,
            }
          : {
              onboardingStatus: nextStatus,
              approvedAt: null,
              approvedByAdminId: null,
            },
    });

    if (result.count === 1) {
      await createPlatformAdminAuditEvent(
        {
          actorAdminId,
          action:
            nextStatus === VendorOnboardingStatus.APPROVED
              ? PLATFORM_ADMIN_AUDIT_ACTIONS.VENDOR_APPROVED
              : PLATFORM_ADMIN_AUDIT_ACTIONS.VENDOR_REJECTED,
          targetType: "vendor",
          targetId: vendorId,
          before: { status: VendorOnboardingStatus.PENDING },
          after: { status: nextStatus },
        },
        tx,
      );
      return;
    }

    const vendor = await tx.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true },
    });
    if (!vendor) {
      throw new PlatformAdminVendorError("Vendor not found", "NOT_FOUND");
    }
    throw new PlatformAdminVendorError(
      "Only pending vendors can be approved or rejected",
      "CONFLICT",
    );
  });

  const updated = await getVendorForPlatformAdmin(vendorId);
  if (!updated) {
    throw new PlatformAdminVendorError(
      "Vendor not found after transition",
      "NOT_FOUND",
    );
  }
  return updated;
}

export function approveVendorForPlatformAdmin(
  vendorId: string,
  actorAdminId: string,
) {
  return transitionPendingVendor(
    vendorId,
    actorAdminId,
    VendorOnboardingStatus.APPROVED,
  );
}

export function rejectVendorForPlatformAdmin(
  vendorId: string,
  actorAdminId: string,
) {
  return transitionPendingVendor(
    vendorId,
    actorAdminId,
    VendorOnboardingStatus.REJECTED,
  );
}
