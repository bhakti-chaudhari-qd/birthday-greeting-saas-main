import { VendorOnboardingStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createRegisteredOrganization,
} from "@/lib/auth/register";
import {
  VendorReferralError,
  normalizeReferralCode,
  resolveOptionalVendorReferral,
} from "@/lib/auth/vendor-referral";
import { prisma } from "@/lib/db";
import { getVendorReferredOrganizations } from "@/lib/vendor/referrals";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

describe("vendor referral attribution", () => {
  beforeAll(async () => {
    if (!databaseUrl) {
      return;
    }
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("normalizes referral codes to uppercase", () => {
    expect(normalizeReferralCode(" demo-code ")).toBe("DEMO-CODE");
  });

  it("resolves optional blank referral to null", async () => {
    await expect(resolveOptionalVendorReferral(undefined)).resolves.toBeNull();
    await expect(resolveOptionalVendorReferral("")).resolves.toBeNull();
    await expect(resolveOptionalVendorReferral("   ")).resolves.toBeNull();
  });

  it("rejects unknown referral codes", async () => {
    await expect(
      resolveOptionalVendorReferral("NOT-A-REAL-CODE"),
    ).rejects.toBeInstanceOf(VendorReferralError);
  });

  it("attributes signup to the vendor and lists referred orgs", async ({
    skip,
  }) => {
    if (!databaseAvailable) {
      skip();
      return;
    }

    const suffix = uniqueSuffix();
    const referralCode = `REF${suffix.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}`;

    const vendor = await prisma.vendor.create({
      data: {
        name: `Referral Vendor ${suffix}`,
        slug: `ref-vendor-${suffix}`,
        referralCode,
        isActive: true,
        onboardingStatus: VendorOnboardingStatus.APPROVED,
      },
    });

    const vendorId = await resolveOptionalVendorReferral(
      referralCode.toLowerCase(),
    );
    expect(vendorId).toBe(vendor.id);

    const registered = await createRegisteredOrganization(
      {
        organizationName: `Referred Org ${suffix}`,
        organizationSlug: `referred-org-${suffix}`,
        timezone: "Asia/Kolkata",
        adminName: "Referred Owner",
        email: `referred-owner-${suffix}@test.local`,
        password: "password12345",
      },
      { referredByVendorId: vendorId },
    );

    expect(registered.organization.referredByVendorId).toBe(vendor.id);
    expect(registered.organization.referredAt).toBeTruthy();

    const listed = await getVendorReferredOrganizations(vendor.id);
    expect(listed.some((row) => row.id === registered.organization.id)).toBe(
      true,
    );
    const row = listed.find((item) => item.id === registered.organization.id);
    expect(row?.ownerEmail).toBe(`referred-owner-${suffix}@test.local`);
    expect(row?.ownerName).toBe("Referred Owner");

    await prisma.organization.delete({
      where: { id: registered.organization.id },
    });
    await prisma.vendor.delete({ where: { id: vendor.id } });
  });

  it("ignores inactive vendor referral codes", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
      return;
    }

    const suffix = uniqueSuffix();
    const referralCode = `OFF${suffix.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}`;

    const vendor = await prisma.vendor.create({
      data: {
        name: `Inactive Vendor ${suffix}`,
        slug: `inactive-vendor-${suffix}`,
        referralCode,
        isActive: false,
        onboardingStatus: VendorOnboardingStatus.APPROVED,
      },
    });

    await expect(
      resolveOptionalVendorReferral(referralCode),
    ).rejects.toBeInstanceOf(VendorReferralError);

    await prisma.vendor.delete({ where: { id: vendor.id } });
  });

  it("ignores unapproved vendor referral codes", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
      return;
    }

    const suffix = uniqueSuffix();
    const referralCode = `PEND${suffix.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}`;
    const vendor = await prisma.vendor.create({
      data: {
        name: `Pending Vendor ${suffix}`,
        slug: `pending-vendor-${suffix}`,
        referralCode,
        isActive: true,
        onboardingStatus: VendorOnboardingStatus.PENDING,
      },
    });

    await expect(
      resolveOptionalVendorReferral(referralCode),
    ).rejects.toBeInstanceOf(VendorReferralError);

    await prisma.vendor.delete({ where: { id: vendor.id } });
  });
});
