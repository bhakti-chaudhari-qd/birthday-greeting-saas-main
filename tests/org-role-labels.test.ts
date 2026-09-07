import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  ORGANIZATION_PORTAL_LABEL,
  PLATFORM_ADMIN_PORTAL_LABEL,
  VENDOR_PORTAL_LABEL,
  getOrganizationRoleLabel,
  organizationRoleCanExportContacts,
  organizationRoleCanExportDeliveries,
} from "@/lib/auth/org-role-labels";

describe("organization role display labels", () => {
  it("maps DB roles to Owner / Staff without colliding with Platform Admin", () => {
    expect(getOrganizationRoleLabel(UserRole.ADMIN)).toBe("Owner");
    expect(getOrganizationRoleLabel(UserRole.STAFF)).toBe("Staff");
    expect(ORGANIZATION_PORTAL_LABEL).toBe("Organization");
    expect(PLATFORM_ADMIN_PORTAL_LABEL).toBe("Platform Admin");
    expect(VENDOR_PORTAL_LABEL).toBe("Vendor");
  });

  it("allows contact export for Owners only", () => {
    expect(organizationRoleCanExportContacts(UserRole.ADMIN)).toBe(true);
    expect(organizationRoleCanExportContacts(UserRole.STAFF)).toBe(false);
  });

  it("allows sent history export for Owners only", () => {
    expect(organizationRoleCanExportDeliveries(UserRole.ADMIN)).toBe(true);
    expect(organizationRoleCanExportDeliveries(UserRole.STAFF)).toBe(false);
  });
});
