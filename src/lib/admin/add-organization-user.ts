import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";

import { strongPassword } from "@/lib/validation/auth";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { lockAndCheckPrincipalEmail } from "@/lib/auth/principal-email";
import { lockAndCheckPrincipalMobile } from "@/lib/auth/principal-mobile";
import { normalizeMobile } from "@/lib/contacts/mobile";
import { RegistrationError } from "@/lib/auth/register";

import {
  createPlatformAdminAuditEvent,
  PLATFORM_ADMIN_AUDIT_ACTIONS,
} from "./audit";
import { PlatformAdminOrgError, type PlatformOrganizationUser } from "./org-ops";

/** Same email/password rules as public signup; role defaults to Staff (Owner already exists on a normal client). */
export const addOrganizationUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  mobile: z.string().trim().min(10).max(16).optional(),
  password: strongPassword,
  role: z.nativeEnum(UserRole).default(UserRole.STAFF),
});

export type AddOrganizationUserInput = z.infer<typeof addOrganizationUserSchema>;

/**
 * Lets a platform admin add a user (Owner or Staff) to an *existing*
 * client's account - e.g. so support/testing has a Staff account to work
 * with, distinct from createClientForPlatformAdmin which creates a brand
 * new organization + Owner. Enforces the same cross-role email/mobile
 * uniqueness as public signup.
 */
export async function addOrganizationUserForPlatformAdmin(
  input: AddOrganizationUserInput,
  organizationId: string,
  actorAdminId: string,
): Promise<PlatformOrganizationUser> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!organization) {
    throw new PlatformAdminOrgError("Client not found");
  }

  let mobile: string | null = null;
  if (input.mobile) {
    try {
      mobile = normalizeMobile(input.mobile);
    } catch (error) {
      throw new RegistrationError(
        error instanceof Error ? error.message : "Invalid mobile number",
        "VALIDATION",
      );
    }
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const principalEmail = await lockAndCheckPrincipalEmail(tx, input.email);
    if (!principalEmail.available) {
      throw new RegistrationError(
        "An account with this email already exists",
        "CONFLICT",
      );
    }

    if (mobile) {
      const principalMobile = await lockAndCheckPrincipalMobile(tx, mobile);
      if (!principalMobile.available) {
        throw new RegistrationError(
          "An account with this mobile number already exists",
          "CONFLICT",
        );
      }
    }

    try {
      return await tx.user.create({
        data: {
          organizationId,
          email: principalEmail.normalizedEmail,
          mobile,
          passwordHash,
          name: input.name,
          role: input.role,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new RegistrationError(
          "An account with this email or mobile already exists",
          "CONFLICT",
        );
      }
      throw error;
    }
  });

  await createPlatformAdminAuditEvent({
    actorAdminId,
    organizationId,
    action: PLATFORM_ADMIN_AUDIT_ACTIONS.ORGANIZATION_USER_ADDED,
    targetType: "organization_user",
    targetId: user.id,
    after: { name: user.name, role: user.role },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}
