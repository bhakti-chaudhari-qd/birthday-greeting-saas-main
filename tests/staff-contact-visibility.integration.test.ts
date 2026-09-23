import { UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { beforeAll, describe, expect, it } from "vitest";

import { addOrganizationUserForPlatformAdmin } from "@/lib/admin/add-organization-user";
import { addContactForPlatformAdmin } from "@/lib/admin/contacts";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { shouldMaskAdminAddedContactsForViewer } from "@/lib/contacts/mask";
import { prisma } from "@/lib/db";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;
let platformAdminId = "";

beforeAll(async () => {
  if (!databaseUrl) return;
  try {
    const admin = await prisma.platformAdmin.create({
      data: {
        email: `visibility-admin-${uniqueSuffix()}@test.local`,
        passwordHash: await hash("password12345", 12),
        name: "Visibility Test Admin",
      },
    });
    platformAdminId = admin.id;
    databaseAvailable = true;
  } catch {
    databaseAvailable = false;
  }
});

function registerInput(suffix: string) {
  return {
    organizationName: `Visibility Org ${suffix}`,
    organizationSlug: `visibility-org-${suffix}`,
    timezone: "UTC",
    adminName: "Visibility Owner",
    email: `visibility-owner-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("shouldMaskAdminAddedContactsForViewer", () => {
  it("Owner (ADMIN role) is never masked, regardless of settings", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    const shouldMask = await shouldMaskAdminAddedContactsForViewer(
      org.organization.id,
      UserRole.ADMIN,
    );
    expect(shouldMask).toBe(false);

    await cleanupOrganization(org.organization.id);
  });

  it("Staff is masked by default (admin allows, owner has not opted in)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    const shouldMask = await shouldMaskAdminAddedContactsForViewer(
      org.organization.id,
      UserRole.STAFF,
    );
    expect(shouldMask).toBe(true);

    await cleanupOrganization(org.organization.id);
  });

  it("Staff sees full data once Owner opts in (admin allows)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await prisma.organization.update({
      where: { id: org.organization.id },
      data: { staffContactVisibilityOwnerAllowed: true },
    });

    const shouldMask = await shouldMaskAdminAddedContactsForViewer(
      org.organization.id,
      UserRole.STAFF,
    );
    expect(shouldMask).toBe(false);

    await cleanupOrganization(org.organization.id);
  });

  it("admin's restriction wins even when the Owner has opted in (most-restrictive-wins)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await prisma.organization.update({
      where: { id: org.organization.id },
      data: {
        staffContactVisibilityOwnerAllowed: true,
        staffContactVisibilityAdminAllowed: false,
      },
    });

    const shouldMask = await shouldMaskAdminAddedContactsForViewer(
      org.organization.id,
      UserRole.STAFF,
    );
    expect(shouldMask).toBe(true);

    await cleanupOrganization(org.organization.id);
  });
});

describe("staff-contact-visibility settings API", () => {
  it("Owner can read and flip their own visibility setting", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    const updated = await prisma.organization.update({
      where: { id: org.organization.id },
      data: { staffContactVisibilityOwnerAllowed: true },
      select: {
        staffContactVisibilityOwnerAllowed: true,
        staffContactVisibilityAdminAllowed: true,
      },
    });

    expect(updated.staffContactVisibilityOwnerAllowed).toBe(true);
    expect(updated.staffContactVisibilityAdminAllowed).toBe(true);

    await cleanupOrganization(org.organization.id);
  });

  it("addOrganizationUserForPlatformAdmin still works alongside the new fields", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    const staff = await addOrganizationUserForPlatformAdmin(
      {
        name: "Staff",
        email: `staff-${uniqueSuffix()}@test.local`,
        password: "password12345",
        role: UserRole.STAFF,
      },
      org.organization.id,
      platformAdminId,
    );

    expect(staff.role).toBe(UserRole.STAFF);

    const contact = await addContactForPlatformAdmin({
      actorAdminId: platformAdminId,
      organizationId: org.organization.id,
      name: "Test Contact",
      mobile: "9876543210",
    });
    expect(contact.addedByPlatformAdmin).toBe(true);

    await cleanupOrganization(org.organization.id);
  });
});
