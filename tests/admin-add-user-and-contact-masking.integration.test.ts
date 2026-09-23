import { hash } from "bcryptjs";
import { beforeAll, describe, expect, it } from "vitest";

import { addOrganizationUserForPlatformAdmin } from "@/lib/admin/add-organization-user";
import { addContactForPlatformAdmin } from "@/lib/admin/contacts";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { RegistrationError } from "@/lib/auth/register";
import { getContactById, updateContact } from "@/lib/contacts/service";
import { serializeContact } from "@/lib/contacts/serialize";
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
        email: `contacts-admin-${uniqueSuffix()}@test.local`,
        passwordHash: await hash("password12345", 12),
        name: "Contacts Test Admin",
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
    organizationName: `Admin User Org ${suffix}`,
    organizationSlug: `admin-user-org-${suffix}`,
    timezone: "UTC",
    adminName: "Admin User Owner",
    email: `admin-user-owner-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("addOrganizationUserForPlatformAdmin", () => {
  it("adds a Staff user to an existing client's account", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    const staff = await addOrganizationUserForPlatformAdmin(
      {
        name: "Staff Person",
        email: `staff-${uniqueSuffix()}@test.local`,
        password: "password12345",
        role: "STAFF" as const,
      },
      org.organization.id,
      platformAdminId,
    );

    expect(staff.role).toBe("STAFF");
    expect(staff.isActive).toBe(true);

    const dbUser = await prisma.user.findUnique({ where: { id: staff.id } });
    expect(dbUser?.organizationId).toBe(org.organization.id);
    expect(dbUser?.passwordHash).toBeTruthy();
    expect(dbUser?.passwordHash).not.toBe("password12345");

    await cleanupOrganization(org.organization.id);
  });

  it("rejects an email already used by another account (cross-role uniqueness)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await expect(
      addOrganizationUserForPlatformAdmin(
        {
          name: "Duplicate",
          email: org.user.email,
          password: "password12345",
          role: "STAFF" as const,
        },
        org.organization.id,
        platformAdminId,
      ),
    ).rejects.toBeInstanceOf(RegistrationError);

    await cleanupOrganization(org.organization.id);
  });
});

describe("Staff masking end-to-end (admin-added contact)", () => {
  it("masks for Staff, shows full for Owner, and unmasks after the client saves an edit", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    const contact = await addContactForPlatformAdmin({
      actorAdminId: platformAdminId,
      organizationId: org.organization.id,
      name: "Ishika",
      mobile: "8999109859",
    });

    expect(contact.addedByPlatformAdmin).toBe(true);

    const loaded = await getContactById(org.organization.id, contact.id);

    const asStaff = serializeContact(loaded, { maskAdminAdded: true });
    expect(asStaff.mobile).toBe("******9859");
    expect(asStaff.mobileMasked).toBe(true);

    const asOwner = serializeContact(loaded, { maskAdminAdded: false });
    expect(asOwner.mobile).toBe("8999109859");
    expect(asOwner.mobileMasked).toBe(false);

    // The client edits and saves (e.g. just the name) - this unmasks it,
    // regardless of whether mobile/email were touched.
    const updated = await updateContact(org.organization.id, contact.id, {
      name: "Ishika Thakur",
    });

    expect(updated.addedByPlatformAdmin).toBe(false);
    const afterEdit = serializeContact(updated, { maskAdminAdded: true });
    expect(afterEdit.mobile).toBe("8999109859");
    expect(afterEdit.mobileMasked).toBe(false);

    await cleanupOrganization(org.organization.id);
  });
});
