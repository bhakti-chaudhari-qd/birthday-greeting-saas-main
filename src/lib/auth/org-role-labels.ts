import { UserRole } from "@prisma/client";

/** User-facing portal names (keep Platform Admin / Vendor distinct from org roles). */
export const ORGANIZATION_PORTAL_LABEL = "Organization";
export const PLATFORM_ADMIN_PORTAL_LABEL = "Platform Admin";
export const VENDOR_PORTAL_LABEL = "Vendor";

/**
 * Display labels for customer-org roles.
 * DB enum stays ADMIN / STAFF - do not show raw "Admin" next to Platform Admin.
 */
export function getOrganizationRoleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return "Owner";
    case UserRole.STAFF:
      return "Staff";
    default:
      return role;
  }
}

export function organizationRoleCanExportContacts(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

export function organizationRoleCanExportDeliveries(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}
