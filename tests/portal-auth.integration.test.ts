import { VendorOnboardingStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hash } from "bcryptjs";

import {
  PlatformAdminLoginError,
  authenticatePlatformAdmin,
} from "@/lib/auth/platform-admin-login";
import {
  VendorLoginError,
  authenticateVendorUser,
} from "@/lib/auth/vendor-login";
import {
  ADMIN_LANDING_PATH,
  VENDOR_LANDING_PATH,
} from "@/lib/auth/constants";
import { authenticateUnifiedUser } from "@/lib/auth/unified-login";
import { listOrganizationsForPlatformAdmin } from "@/lib/admin/organizations";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;


describe("portal auth (admin + vendor)", () => {
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

  it("rejects invalid platform admin credentials", async ({ skip }) => {
    if (!databaseAvailable) skip();

    await expect(
      authenticatePlatformAdmin({
        email: "missing-admin@test.local",
        password: "wrong-password",
      }),
    ).rejects.toBeInstanceOf(PlatformAdminLoginError);
  });

  it("authenticates a platform admin and lists organizations", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const passwordHash = await hash("password12345", 12);
    const email = `platform-${suffix}@test.local`;

    await prisma.platformAdmin.create({
      data: {
        email,
        passwordHash,
        name: "Test Platform Admin",
      },
    });

    const admin = await authenticatePlatformAdmin({
      email,
      password: "password12345",
    });

    expect(admin.email).toBe(email);

    const organizations = await listOrganizationsForPlatformAdmin();
    expect(Array.isArray(organizations)).toBe(true);

    await prisma.platformAdmin.delete({ where: { email } });
  });

  it("routes platform admins through unified sign in", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const passwordHash = await hash("password12345", 12);
    const email = `platform-unified-${suffix}@test.local`;

    const admin = await prisma.platformAdmin.create({
      data: {
        email,
        passwordHash,
        name: "Unified Platform Admin",
      },
    });

    const result = await authenticateUnifiedUser({
      email,
      password: "password12345",
    });

    expect(result.portal).toBe("platform-admin");
    expect(result.redirectTo).toBe(ADMIN_LANDING_PATH);
    expect(result.user.id).toBe(admin.id);

    await prisma.platformAdmin.delete({ where: { email } });
  });

  it("rejects invalid vendor credentials", async ({ skip }) => {
    if (!databaseAvailable) skip();

    await expect(
      authenticateVendorUser({
        email: "missing-vendor@test.local",
        password: "wrong-password",
      }),
    ).rejects.toBeInstanceOf(VendorLoginError);
  });

  it("authenticates a vendor user for an active vendor", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const passwordHash = await hash("password12345", 12);
    const vendor = await prisma.vendor.create({
      data: {
        name: `Vendor ${suffix}`,
        slug: `vendor-${suffix}`,
        referralCode: `V${suffix.replace(/[^a-z0-9]/gi, "").slice(0, 10).toUpperCase()}`,
        onboardingStatus: VendorOnboardingStatus.APPROVED,
        users: {
          create: {
            email: `vendor-${suffix}@test.local`,
            passwordHash,
            name: "Vendor Tester",
          },
        },
      },
    });

    const vendorUser = await authenticateVendorUser({
      email: `vendor-${suffix}@test.local`,
      password: "password12345",
    });

    expect(vendorUser.vendorId).toBe(vendor.id);
    expect(vendorUser.vendor.name).toBe(vendor.name);

    await prisma.vendor.delete({ where: { id: vendor.id } });
  });

  it("routes vendors through unified sign in", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const passwordHash = await hash("password12345", 12);
    const email = `vendor-unified-${suffix}@test.local`;
    const vendor = await prisma.vendor.create({
      data: {
        name: `Unified Vendor ${suffix}`,
        slug: `unified-vendor-${suffix}`,
        referralCode: `U${suffix.replace(/[^a-z0-9]/gi, "").slice(0, 10).toUpperCase()}`,
        onboardingStatus: VendorOnboardingStatus.APPROVED,
        users: {
          create: {
            email,
            passwordHash,
            name: "Unified Vendor Tester",
          },
        },
      },
      include: { users: true },
    });

    const result = await authenticateUnifiedUser({
      email,
      password: "password12345",
    });

    expect(result.portal).toBe("vendor");
    expect(result.redirectTo).toBe(VENDOR_LANDING_PATH);
    expect(result.user.id).toBe(vendor.users[0].id);
    expect(result.user.vendorId).toBe(vendor.id);

    await prisma.vendor.delete({ where: { id: vendor.id } });
  });
});
