import { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";

/**
 * Whether a Staff viewer should see a Platform-Admin-added contact's real
 * mobile/email masked. The Owner always sees it in full. For Staff, both
 * the admin-controlled ceiling (Organization.staffContactVisibilityAdminAllowed)
 * and the Owner's own choice (staffContactVisibilityOwnerAllowed) must allow
 * it - most-restrictive-wins - otherwise it's masked. Defaults preserve the
 * original always-masked-for-Staff behavior until the Owner opts in.
 */
export async function shouldMaskAdminAddedContactsForViewer(
  organizationId: string,
  viewerRole: UserRole,
): Promise<boolean> {
  if (viewerRole === UserRole.ADMIN) {
    return false;
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      staffContactVisibilityAdminAllowed: true,
      staffContactVisibilityOwnerAllowed: true,
    },
  });

  if (!organization) {
    return true;
  }

  const staffAllowed =
    organization.staffContactVisibilityAdminAllowed &&
    organization.staffContactVisibilityOwnerAllowed;

  return !staffAllowed;
}

/** Same shape as the provider-log masking (e.g. "******3210"). */
export function maskMobileForDisplay(mobile: string): string {
  return mobile.length <= 4
    ? mobile
    : `${"*".repeat(mobile.length - 4)}${mobile.slice(-4)}`;
}

/** "jo***@example.com" - keeps up to 2 leading local-part characters and the domain. */
export function maskEmailForDisplay(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) {
    return "***";
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  const maskedLength = Math.max(local.length - visible.length, 3);

  return `${visible}${"*".repeat(maskedLength)}@${domain}`;
}
