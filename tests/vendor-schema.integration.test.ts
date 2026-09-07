import {
  Prisma,
  VendorOnboardingStatus,
  VendorRegistrationInviteDeliveryStatus,
} from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const model = (name: string) => {
  const found = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === name);

  expect(found, `Expected Prisma model ${name}`).toBeDefined();
  return found!;
};

const field = (modelName: string, fieldName: string) => {
  const found = model(modelName).fields.find((candidate) => candidate.name === fieldName);

  expect(found, `Expected ${modelName}.${fieldName}`).toBeDefined();
  return found!;
};

describe("vendor onboarding schema", () => {
  it("exposes the onboarding and invite delivery states", () => {
    expect(Object.values(VendorOnboardingStatus)).toEqual([
      "DRAFT",
      "INVITED",
      "PENDING",
      "APPROVED",
      "REJECTED",
    ]);
    expect(Object.values(VendorRegistrationInviteDeliveryStatus)).toEqual([
      "PENDING",
      "SENT",
      "AMBIGUOUS",
      "FAILED",
    ]);
  });

  it("supports legacy contact data while keeping new identifiers unique", () => {
    expect(field("Vendor", "mobile")).toMatchObject({
      isRequired: false,
      isUnique: true,
    });
    expect(field("Vendor", "onboardingStatus")).toMatchObject({
      isRequired: true,
      default: "DRAFT",
    });
    expect(field("VendorUser", "email")).toMatchObject({
      isRequired: false,
      isUnique: true,
    });
    expect(field("VendorUser", "mobile")).toMatchObject({
      isRequired: false,
      isUnique: true,
    });
  });

  it("uses distinct admin relations for approvals and invite creation", () => {
    expect(field("Vendor", "approvedByAdmin")).toMatchObject({
      relationName: "VendorApprovedByAdmin",
    });
    expect(field("VendorRegistrationInvite", "createdByAdmin")).toMatchObject({
      relationName: "VendorInviteCreatedByAdmin",
    });
    expect(field("VendorRegistrationInvite", "tokenHash")).toMatchObject({
      isRequired: true,
      isUnique: true,
    });
  });

  it("backfills legacy vendors as approved before enforcing the default", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "prisma",
        "migrations",
        "20260721140000_add_vendor_onboarding_schema",
        "migration.sql",
      ),
      "utf8",
    );

    const backfillPosition = migration.indexOf(
      `SET "onboardingStatus" = 'APPROVED'`,
    );
    const notNullPosition = migration.indexOf(
      `ALTER COLUMN "onboardingStatus" SET NOT NULL`,
    );

    expect(backfillPosition).toBeGreaterThan(-1);
    expect(notNullPosition).toBeGreaterThan(backfillPosition);
    expect(migration).toContain(`ALTER COLUMN "email" DROP NOT NULL`);
    expect(migration).toContain(
      `"VendorRegistrationInvite_one_active_pending_per_vendor"`,
    );
  });
});
