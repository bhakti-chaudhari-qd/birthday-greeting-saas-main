import { createHash } from "node:crypto";

import {
  Prisma,
  VendorOnboardingStatus,
  VendorRegistrationInviteDeliveryStatus,
} from "@prisma/client";

import { hashPassword } from "@/lib/auth/password";
import { lockAndCheckPrincipalEmail } from "@/lib/auth/principal-email";
import { normalizeMobile } from "@/lib/contacts/mobile";
import { prisma } from "@/lib/db";
import type { VendorRegistrationInput } from "@/lib/validation/auth";
import {
  PLATFORM_ADMIN_AUDIT_ACTIONS,
  createPlatformAdminAuditEvent,
} from "@/lib/admin/audit";

const RAW_INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const INVALID_VENDOR_INVITE_MESSAGE =
  "This registration invitation is invalid or unavailable.";
export const DUPLICATE_VENDOR_IDENTIFIER_MESSAGE =
  "An account with this email or mobile already exists.";

export type SafeVendorRegistrationInvite = {
  vendorName: string;
  maskedMobile: string;
};

export class VendorRegistrationError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_INVITE" | "CONFLICT",
  ) {
    super(message);
    this.name = "VendorRegistrationError";
  }
}

export function hashVendorRegistrationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function maskVendorMobile(mobile: string): string {
  return `******${mobile.slice(-4)}`;
}

function invalidInvite(): VendorRegistrationError {
  return new VendorRegistrationError(
    INVALID_VENDOR_INVITE_MESSAGE,
    "INVALID_INVITE",
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function inspectVendorRegistrationInvite(
  rawToken: string,
  now = new Date(),
): Promise<SafeVendorRegistrationInvite | null> {
  if (!RAW_INVITE_TOKEN_PATTERN.test(rawToken)) {
    return null;
  }

  const invite = await prisma.vendorRegistrationInvite.findFirst({
    where: {
      tokenHash: hashVendorRegistrationToken(rawToken),
      deliveryStatus: {
        in: [
          VendorRegistrationInviteDeliveryStatus.SENT,
          VendorRegistrationInviteDeliveryStatus.AMBIGUOUS,
        ],
      },
      expiresAt: { gt: now },
      usedAt: null,
      revokedAt: null,
      vendor: {
        onboardingStatus: VendorOnboardingStatus.INVITED,
        users: { none: {} },
        mobile: { not: null },
      },
    },
    select: {
      vendor: {
        select: {
          name: true,
          mobile: true,
        },
      },
    },
  });

  if (!invite?.vendor.mobile) {
    return null;
  }

  try {
    const mobile = normalizeMobile(invite.vendor.mobile);
    return {
      vendorName: invite.vendor.name,
      maskedMobile: maskVendorMobile(mobile),
    };
  } catch {
    return null;
  }
}

export async function registerInvitedVendor(
  input: VendorRegistrationInput,
  now = new Date(),
): Promise<{ onboardingStatus: "PENDING" }> {
  const tokenHash = hashVendorRegistrationToken(input.token);
  if (!(await inspectVendorRegistrationInvite(input.token, now))) {
    throw invalidInvite();
  }
  const passwordHash = await hashPassword(input.password);
  const normalizedEmail = input.email?.trim().toLowerCase();

  try {
    await prisma.$transaction(async (tx) => {
      const invite = await tx.vendorRegistrationInvite.findFirst({
        where: {
          tokenHash,
          deliveryStatus: {
            in: [
              VendorRegistrationInviteDeliveryStatus.SENT,
              VendorRegistrationInviteDeliveryStatus.AMBIGUOUS,
            ],
          },
          expiresAt: { gt: now },
          usedAt: null,
          revokedAt: null,
        },
        select: {
          id: true,
          vendor: {
            select: {
              id: true,
              mobile: true,
              onboardingStatus: true,
            },
          },
        },
      });

      if (!invite) {
        throw invalidInvite();
      }

      const claimed = await tx.vendorRegistrationInvite.updateMany({
        where: {
          id: invite.id,
          tokenHash,
          deliveryStatus: {
            in: [
              VendorRegistrationInviteDeliveryStatus.SENT,
              VendorRegistrationInviteDeliveryStatus.AMBIGUOUS,
            ],
          },
          expiresAt: { gt: now },
          usedAt: null,
          revokedAt: null,
        },
        data: { usedAt: now },
      });

      if (claimed.count !== 1) {
        throw invalidInvite();
      }

      if (
        invite.vendor.onboardingStatus !== VendorOnboardingStatus.INVITED ||
        !invite.vendor.mobile
      ) {
        throw invalidInvite();
      }

      const existingVendorUser = await tx.vendorUser.findFirst({
        where: { vendorId: invite.vendor.id },
        select: { id: true },
      });
      if (existingVendorUser) {
        throw invalidInvite();
      }

      let mobile: string;
      try {
        mobile = normalizeMobile(invite.vendor.mobile);
      } catch {
        throw invalidInvite();
      }

      if (normalizedEmail) {
        const principalEmail = await lockAndCheckPrincipalEmail(
          tx,
          normalizedEmail,
        );
        if (!principalEmail.available) {
          throw new VendorRegistrationError(
            DUPLICATE_VENDOR_IDENTIFIER_MESSAGE,
            "CONFLICT",
          );
        }
      }

      const duplicateMobile = await tx.vendorUser.findFirst({
        where: { mobile },
        select: { id: true },
      });
      if (duplicateMobile) {
        throw new VendorRegistrationError(
          DUPLICATE_VENDOR_IDENTIFIER_MESSAGE,
          "CONFLICT",
        );
      }

      await tx.vendorUser.create({
        data: {
          vendorId: invite.vendor.id,
          email: normalizedEmail,
          mobile,
          passwordHash,
          name: input.contactName,
        },
      });

      const vendorUpdated = await tx.vendor.updateMany({
        where: {
          id: invite.vendor.id,
          onboardingStatus: VendorOnboardingStatus.INVITED,
        },
        data: {
          onboardingStatus: VendorOnboardingStatus.PENDING,
          registrationSubmittedAt: now,
        },
      });
      if (vendorUpdated.count !== 1) {
        throw invalidInvite();
      }
      await createPlatformAdminAuditEvent(
        {
          actorAdminId: null,
          action: PLATFORM_ADMIN_AUDIT_ACTIONS.VENDOR_REGISTRATION_SUBMITTED,
          targetType: "vendor",
          targetId: invite.vendor.id,
          before: { status: VendorOnboardingStatus.INVITED },
          after: { status: VendorOnboardingStatus.PENDING },
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof VendorRegistrationError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new VendorRegistrationError(
        DUPLICATE_VENDOR_IDENTIFIER_MESSAGE,
        "CONFLICT",
      );
    }
    throw error;
  }

  return { onboardingStatus: "PENDING" };
}
