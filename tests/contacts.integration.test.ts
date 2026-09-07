import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { listContactCategories } from "@/lib/contacts/categories";
import {
  ContactConflictError,
  ContactLimitError,
  ContactNotFoundError,
  ContactValidationError,
} from "@/lib/contacts/errors";
import {
  createContact,
  deleteContact,
  getContactById,
  listContacts,
  updateContact,
  bulkUpdateContactStatus,
  bulkDeleteContacts,
} from "@/lib/contacts/service";
import { createOccasion, ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { createContactSchema } from "@/lib/validation/contact";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `Contacts Org ${suffix}`,
    organizationSlug: `contacts-org-${suffix}`,
    timezone: "UTC",
    adminName: "Contacts Admin",
    email: `contacts-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("contacts CRUD", () => {
  beforeAll(async () => {
    if (!databaseUrl) {
      return;
    }

    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a contact in the authenticated organization", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));
    const contact = await createContact(org.organization.id, {
      name: "Alice",
      mobile: testMobile(),
      isActive: true,
    });

    expect(contact.organizationId).toBe(org.organization.id);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects client-supplied organizationId in create schema", () => {
    const parsed = createContactSchema.safeParse({
      name: "Alice",
      mobile: "+919876543210",
      organizationId: "other-org",
    });

    expect(parsed.success).toBe(false);
  });

  it("prevents organization A from listing organization B contacts", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(registerInput(`a-${uniqueSuffix()}`));
    const orgB = await createRegisteredOrganization(registerInput(`b-${uniqueSuffix()}`));

    await createContact(orgA.organization.id, {
      name: "Tenant A Contact",
      mobile: testMobile(),

      isActive: true,
    });

    const orgBList = await listContacts(orgB.organization.id, {
      page: 1,
      limit: 20,
      isActive: "all",
    });

    expect(orgBList.data).toHaveLength(0);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("returns safe 404 for cross-tenant contact lookup", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(registerInput(`a-${uniqueSuffix()}`));
    const orgB = await createRegisteredOrganization(registerInput(`b-${uniqueSuffix()}`));
    const contact = await createContact(orgA.organization.id, {
      name: "Protected",
      mobile: testMobile(),

      isActive: true,
    });

    await expect(getContactById(orgB.organization.id, contact.id)).rejects.toBeInstanceOf(
      ContactNotFoundError,
    );

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("prevents organization A from updating organization B contacts", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(registerInput(`a-${uniqueSuffix()}`));
    const orgB = await createRegisteredOrganization(registerInput(`b-${uniqueSuffix()}`));
    const contact = await createContact(orgA.organization.id, {
      name: "Protected",
      mobile: testMobile(),

      isActive: true,
    });

    await expect(
      updateContact(orgB.organization.id, contact.id, { name: "Hacked" }),
    ).rejects.toBeInstanceOf(ContactNotFoundError);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("enforces tenant-scoped duplicate mobile", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));
    const mobile = testMobile();

    await createContact(org.organization.id, {
      name: "First",
      mobile,

      isActive: true,
    });

    await expect(
      createContact(org.organization.id, {
        name: "Second",
        mobile,

        isActive: true,
      }),
    ).rejects.toBeInstanceOf(ContactConflictError);

    await cleanupOrganization(org.organization.id);
  });

  it("allows the same mobile in different organizations", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const mobile = testMobile();
    const orgA = await createRegisteredOrganization(registerInput(`a-${uniqueSuffix()}`));
    const orgB = await createRegisteredOrganization(registerInput(`b-${uniqueSuffix()}`));

    await createContact(orgA.organization.id, {
      name: "A",
      mobile,

      isActive: true,
    });

    await expect(
      createContact(orgB.organization.id, {
        name: "B",
        mobile,

        isActive: true,
      }),
    ).resolves.toBeDefined();

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("rejects invalid contact input", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await expect(
      createContact(org.organization.id, {
        name: "Bad",
        mobile: "12345",

        isActive: true,
      }),
    ).rejects.toBeInstanceOf(ContactValidationError);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects impossible birthdays", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    await expect(
      createContact(org.organization.id, {
        name: "Bad Date",
        mobile: testMobile(),
        occasionDates: { [birthday.id]: "2024-02-30" },
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(ContactValidationError);

    await cleanupOrganization(org.organization.id);
  });

  it("supports leap-day birthdays", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const contact = await createContact(org.organization.id, {
      name: "Leap",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "2000-02-29" },
      isActive: true,
    });

    const date = contact.occasionDates.find((d) => d.occasionId === birthday.id);
    expect(date?.month).toBe(2);
    expect(date?.day).toBe(29);

    await cleanupOrganization(org.organization.id);
  });

  it("persists anniversary date month and day", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const anniversary = await createOccasion(org.organization.id, "Anniversary");
    const contact = await createContact(org.organization.id, {
      name: "Anniv",
      mobile: testMobile(),
      occasionDates: { [anniversary.id]: "2015-06-15" },
      isActive: true,
    });

    const date = contact.occasionDates.find((d) => d.occasionId === anniversary.id);
    expect(date?.month).toBe(6);
    expect(date?.day).toBe(15);

    const updated = await updateContact(org.organization.id, contact.id, {
      occasionDates: { [anniversary.id]: "2016-12-01" },
    });

    const updatedDate = updated.occasionDates.find(
      (d) => d.occasionId === anniversary.id,
    );
    expect(updatedDate?.month).toBe(12);
    expect(updatedDate?.day).toBe(1);

    await cleanupOrganization(org.organization.id);
  });

  it("persists a user-created occasion date month and day", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const diwali = await createOccasion(org.organization.id, "Diwali");
    const contact = await createContact(org.organization.id, {
      name: "Custom",
      mobile: testMobile(),
      occasionDates: { [diwali.id]: "2020-01-26" },
      isActive: true,
    });

    const date = contact.occasionDates.find((d) => d.occasionId === diwali.id);
    expect(date?.month).toBe(1);
    expect(date?.day).toBe(26);

    await cleanupOrganization(org.organization.id);
  });

  it("stores category and address and filters by category", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const categories = await listContactCategories(org.organization.id);
    const vip = categories.find((c) => c.name === "VIP");
    const friend = categories.find((c) => c.name === "Friend");
    expect(vip).toBeTruthy();
    expect(friend).toBeTruthy();

    const contact = await createContact(org.organization.id, {
      name: "VIP Guest",
      mobile: testMobile(),
      categoryId: vip!.id,
      address: "12 MG Road, Pune",

      isActive: true,
    });

    expect(contact.categoryId).toBe(vip!.id);
    expect(contact.category?.name).toBe("VIP");
    expect(contact.address).toBe("12 MG Road, Pune");

    await createContact(org.organization.id, {
      name: "Friend Guest",
      mobile: testMobile(),
      categoryId: friend!.id,

      isActive: true,
    });

    const vipOnly = await listContacts(org.organization.id, {
      page: 1,
      limit: 20,
      isActive: "all",
      categoryId: vip!.id,
    });

    expect(vipOnly.data).toHaveLength(1);
    expect(vipOnly.data[0]?.name).toBe("VIP Guest");

    const updated = await updateContact(org.organization.id, contact.id, {
      categoryId: null,
      address: null,
    });
    expect(updated.categoryId).toBeNull();
    expect(updated.category).toBeNull();
    expect(updated.address).toBeNull();

    await cleanupOrganization(org.organization.id);
  });

  it("scopes search results to the tenant", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const orgA = await createRegisteredOrganization(registerInput(`a-${suffix}`));
    const orgB = await createRegisteredOrganization(registerInput(`b-${suffix}`));

    await createContact(orgA.organization.id, {
      name: "FindMeUnique",
      mobile: testMobile(),

      isActive: true,
    });

    const orgBSearch = await listContacts(orgB.organization.id, {
      page: 1,
      limit: 20,
      search: "FindMeUnique",
      isActive: "all",
    });

    expect(orgBSearch.data).toHaveLength(0);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("returns stable pagination ordering", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));

    for (let index = 0; index < 3; index += 1) {
      await createContact(org.organization.id, {
        name: `Contact ${index}`,
        mobile: testMobile(),

        isActive: true,
      });
    }

    const page1 = await listContacts(org.organization.id, {
      page: 1,
      limit: 2,
      isActive: "all",
    });
    const page2 = await listContacts(org.organization.id, {
      page: 2,
      limit: 2,
      isActive: "all",
    });

    expect(page1.data).toHaveLength(2);
    expect(page2.data).toHaveLength(1);
    expect(page1.meta.total).toBe(3);

    await cleanupOrganization(org.organization.id);
  });

  it("filters active and inactive contacts", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));

    await createContact(org.organization.id, {
      name: "Active",
      mobile: testMobile(),

      isActive: true,
    });

    await createContact(org.organization.id, {
      name: "Inactive",
      mobile: testMobile(),

      isActive: false,
    });

    const activeOnly = await listContacts(org.organization.id, {
      page: 1,
      limit: 20,
      isActive: "true",
    });
    const inactiveOnly = await listContacts(org.organization.id, {
      page: 1,
      limit: 20,
      isActive: "false",
    });

    expect(activeOnly.data).toHaveLength(1);
    expect(inactiveOnly.data).toHaveLength(1);
    expect(activeOnly.data[0]?.name).toBe("Active");
    expect(inactiveOnly.data[0]?.name).toBe("Inactive");

    await cleanupOrganization(org.organization.id);
  });

  it("enforces contact limits for active contacts", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));

    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: { contactLimit: 1 },
    });

    await createContact(org.organization.id, {
      name: "Only One",
      mobile: testMobile(),

      isActive: true,
    });

    await expect(
      createContact(org.organization.id, {
        name: "Too Many",
        mobile: testMobile(),

        isActive: true,
      }),
    ).rejects.toBeInstanceOf(ContactLimitError);

    await cleanupOrganization(org.organization.id);
  });

  it("deletes a contact and related queue history", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));
    const contact = await createContact(org.organization.id, {
      name: "Delete Me",
      mobile: testMobile(),

      isActive: true,
    });

    await deleteContact(org.organization.id, contact.id);

    await expect(
      getContactById(org.organization.id, contact.id),
    ).rejects.toBeInstanceOf(ContactNotFoundError);

    await cleanupOrganization(org.organization.id);
  });

  it("bulk deactivates and activates selected contacts", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));
    const a = await createContact(org.organization.id, {
      name: "Bulk A",
      mobile: testMobile(),
      isActive: true,
    });
    const b = await createContact(org.organization.id, {
      name: "Bulk B",
      mobile: testMobile(),
      isActive: true,
    });

    const deactivated = await bulkUpdateContactStatus(org.organization.id, {
      ids: [a.id, b.id],
      isActive: false,
    });
    expect(deactivated.updated).toBe(2);

    const inactiveList = await listContacts(org.organization.id, {
      page: 1,
      limit: 20,
      isActive: "false",
    });
    expect(inactiveList.data.map((c) => c.id).sort()).toEqual(
      [a.id, b.id].sort(),
    );

    const activated = await bulkUpdateContactStatus(org.organization.id, {
      ids: [a.id, b.id],
      isActive: true,
    });
    expect(activated.updated).toBe(2);

    await cleanupOrganization(org.organization.id);
  });

  it("bulk deletes selected contacts", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));
    const a = await createContact(org.organization.id, {
      name: "Delete Bulk A",
      mobile: testMobile(),
      isActive: true,
    });
    const b = await createContact(org.organization.id, {
      name: "Delete Bulk B",
      mobile: testMobile(),
      isActive: true,
    });

    const result = await bulkDeleteContacts(org.organization.id, {
      ids: [a.id, b.id],
    });
    expect(result.deleted).toBe(2);

    await expect(
      getContactById(org.organization.id, a.id),
    ).rejects.toBeInstanceOf(ContactNotFoundError);

    await cleanupOrganization(org.organization.id);
  });
});
