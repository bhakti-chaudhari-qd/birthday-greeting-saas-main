import { signupSchema } from "@/lib/validation/auth";
import { createRegisteredOrganization } from "@/lib/auth/register";
import type { RegisterInput } from "@/lib/validation/auth";
import {
  PLATFORM_ADMIN_AUDIT_ACTIONS,
  createPlatformAdminAuditEvent,
} from "@/lib/admin/audit";

/** Same fields and rules as public signup (strong password, unique email/mobile, mandatory mobile + WhatsApp number), minus the vendor referral code. */
export const createClientSchema = signupSchema.omit({ referralCode: true });

export type CreateClientInput = Omit<RegisterInput, "referralCode">;

/**
 * Creates a client organization with its Owner account on behalf of a
 * Platform Admin. Unlike public signup this never starts a session, so the
 * admin stays signed in as themselves.
 */
export async function createClientForPlatformAdmin(
  input: CreateClientInput,
  actorAdminId: string,
) {
  const { organization, user } = await createRegisteredOrganization(input);

  try {
    await createPlatformAdminAuditEvent({
      actorAdminId,
      organizationId: organization.id,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.ORGANIZATION_CREATED,
      targetType: "organization",
      targetId: organization.id,
      after: { name: organization.name },
    });
  } catch (error) {
    // The client already exists; a failed audit write must not make the admin retry into a conflict.
    console.error("Failed to record client creation audit event", error);
  }

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    owner: { id: user.id, email: user.email, name: user.name },
  };
}
