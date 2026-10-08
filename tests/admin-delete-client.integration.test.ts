import { hash } from "bcryptjs";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { PLATFORM_ADMIN_AUDIT_ACTIONS } from "@/lib/admin/audit";
import {
  PlatformAdminOrgDeleteError,
  PlatformAdminOrgError,
  deleteOrganizationForPlatformAdmin,
} from "@/lib/admin/org-ops";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { prisma } from "@/lib/db";
import type { DocumentStorage } from "@/lib/storage";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;
let platformAdminId = "";

beforeAll(async () => {
  if (!databaseUrl) return;
  try {
    const admin = await prisma.platformAdmin.create({
      data: {
        email: `delete-client-admin-${uniqueSuffix()}@test.local`,
        passwordHash: await hash("password12345", 12),
        name: "Delete Client Test Admin",
      },
    });
    platformAdminId = admin.id;
    databaseAvailable = true;
  } catch {
    databaseAvailable = false;
  }
});

async function createOrg() {
  const suffix = uniqueSuffix();
  const created = await createRegisteredOrganization({
    organizationName: `Delete Me ${suffix}`,
    organizationSlug: `delete-me-${suffix}`,
    timezone: "Asia/Kolkata",
    adminName: "Owner",
    email: `delete-me-${suffix}@test.local`,
    password: "password12345",
  });
  return created.organization;
}

const noopStorage = { delete: vi.fn(async () => {}) } as unknown as DocumentStorage;

describe("deleteOrganizationForPlatformAdmin", () => {
  it("removes the client with its users and records an audit event", async ({ skip }) => {
    if (!databaseAvailable) skip();
    const organization = await createOrg();

    await deleteOrganizationForPlatformAdmin(
      organization.id,
      { confirmName: organization.name },
      platformAdminId,
      { storage: noopStorage },
    );

    expect(
      await prisma.organization.findUnique({ where: { id: organization.id } }),
    ).toBeNull();
    expect(
      await prisma.user.count({ where: { organizationId: organization.id } }),
    ).toBe(0);

    const event = await prisma.platformAdminAuditEvent.findFirst({
      where: {
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.ORGANIZATION_DELETED,
        targetId: organization.id,
      },
    });
    expect(event?.actorAdminId).toBe(platformAdminId);
    expect(event?.before).toMatchObject({ name: organization.name });
  });

  it("refuses when the typed name does not match, and keeps the client", async ({ skip }) => {
    if (!databaseAvailable) skip();
    const organization = await createOrg();

    await expect(
      deleteOrganizationForPlatformAdmin(
        organization.id,
        { confirmName: "Some other client" },
        platformAdminId,
        { storage: noopStorage },
      ),
    ).rejects.toBeInstanceOf(PlatformAdminOrgDeleteError);

    expect(
      await prisma.organization.findUnique({ where: { id: organization.id } }),
    ).not.toBeNull();

    await prisma.organization.delete({ where: { id: organization.id } });
  });

  it("reports an unknown client as not found", async ({ skip }) => {
    if (!databaseAvailable) skip();

    await expect(
      deleteOrganizationForPlatformAdmin(
        "missing-client-id",
        { confirmName: "anything" },
        platformAdminId,
        { storage: noopStorage },
      ),
    ).rejects.toBeInstanceOf(PlatformAdminOrgError);
  });
});
