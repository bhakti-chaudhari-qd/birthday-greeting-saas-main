import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RegistrationError, createRegisteredOrganization } from "@/lib/auth/register";
import { prisma } from "@/lib/db";
import { uniqueSuffix } from "./helpers";

function randomMobile(): string {
  return `9${Math.floor(Math.random() * 1e9).toString().padStart(9, "0")}`;
}

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function orgInput(suffix: string, overrides: Record<string, unknown> = {}) {
  return {
    organizationName: `Uniq ${suffix}`,
    organizationSlug: `uniq-${suffix}`,
    timezone: "UTC",
    adminName: "Owner",
    email: `uniq-${suffix}@test.local`,
    password: "password12345",
    ...overrides,
  };
}

async function expectConflict(promise: Promise<unknown>, message: RegExp) {
  await expect(promise).rejects.toMatchObject({
    name: "RegistrationError",
    code: "CONFLICT",
    message: expect.stringMatching(message),
  });
}

describe("registration uniqueness (one identity, one account)", () => {
  beforeAll(async () => {
    if (!databaseUrl) return;
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

  it("rejects a second registration with the same email", async ({ skip }) => {
    if (!databaseAvailable) skip();
    const suffix = uniqueSuffix();
    await createRegisteredOrganization(orgInput(suffix));
    await expectConflict(
      createRegisteredOrganization(
        orgInput(`${suffix}b`, { email: `UNIQ-${suffix}@test.local` }),
      ),
      /email/i,
    );
  });

  it("rejects a second registration with the same mobile", async ({ skip }) => {
    if (!databaseAvailable) skip();
    const suffix = uniqueSuffix();
    const mobile = randomMobile();
    await createRegisteredOrganization(orgInput(suffix, { mobile }));
    await expectConflict(
      createRegisteredOrganization(
        orgInput(`${suffix}b`, { mobile: `+91${mobile}` }),
      ),
      /mobile/i,
    );
  });

  it("rejects an email that already belongs to a platform admin", async ({ skip }) => {
    if (!databaseAvailable) skip();
    const suffix = uniqueSuffix();
    const email = `admin-${suffix}@test.local`;
    await prisma.platformAdmin.create({
      data: { email, passwordHash: "x", name: "Admin" },
    });
    await expectConflict(
      createRegisteredOrganization(orgInput(suffix, { email })),
      /email/i,
    );
  });

  it("rejects an email that already belongs to a vendor user", async ({ skip }) => {
    if (!databaseAvailable) skip();
    const suffix = uniqueSuffix();
    const email = `vendor-${suffix}@test.local`;
    const vendor = await prisma.vendor.create({
      data: { name: `V ${suffix}`, slug: `v-${suffix}`, referralCode: `R${suffix}`.slice(0, 20).toUpperCase() },
    });
    await prisma.vendorUser.create({
      data: { vendorId: vendor.id, email, passwordHash: "x", name: "Vendor" },
    });
    await expectConflict(
      createRegisteredOrganization(orgInput(suffix, { email })),
      /email/i,
    );
  });

  it("rejects a mobile that already belongs to a vendor", async ({ skip }) => {
    if (!databaseAvailable) skip();
    const suffix = uniqueSuffix();
    const mobile = randomMobile();
    await prisma.vendor.create({
      data: {
        name: `V ${suffix}`,
        slug: `vm-${suffix}`,
        mobile,
        referralCode: `M${suffix}`.slice(0, 20).toUpperCase(),
      },
    });
    await expectConflict(
      createRegisteredOrganization(orgInput(suffix, { mobile })),
      /mobile/i,
    );
  });

  it("rejects an invalid mobile as a validation error", async ({ skip }) => {
    if (!databaseAvailable) skip();
    const suffix = uniqueSuffix();
    await expect(
      createRegisteredOrganization(orgInput(suffix, { mobile: "12345" })),
    ).rejects.toBeInstanceOf(RegistrationError);
  });
});
