import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    platformAdminAuditEvent: {
      create: dbMocks.create,
      findMany: dbMocks.findMany,
    },
  },
}));

import {
  PLATFORM_ADMIN_AUDIT_ACTIONS,
  createPlatformAdminAuditEvent,
  listPlatformAdminAuditEventsForOrganization,
  listPlatformAdminAuditEventsForVendor,
} from "@/lib/admin/audit";

describe("Platform Admin audit service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attributes the actor and persists only allowlisted JSON values", async () => {
    dbMocks.create.mockResolvedValue({ id: "audit-1" });

    await createPlatformAdminAuditEvent({
      actorAdminId: "admin-from-session",
      organizationId: "org-1",
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.ORGANIZATION_UPDATED,
      targetType: "organization",
      targetId: "org-1",
      before: {
        isActive: true,
        passwordHash: "must-not-be-recorded",
      },
      after: {
        isActive: false,
        recipient: "must-not-be-recorded",
      },
      metadata: {
        changedFields: ["isActive", "passwordHash"],
        providerResponse: { token: "must-not-be-recorded" },
      },
    } as never);

    expect(dbMocks.create).toHaveBeenCalledWith({
      data: {
        actorAdminId: "admin-from-session",
        organizationId: "org-1",
        action: "ORGANIZATION_UPDATED",
        targetType: "organization",
        targetId: "org-1",
        before: { isActive: true },
        after: { isActive: false },
        metadata: { changedFields: ["isActive"] },
      },
    });
    expect(JSON.stringify(dbMocks.create.mock.calls[0])).not.toContain(
      "must-not-be-recorded",
    );
  });

  it("lists only recent events scoped to the organization", async () => {
    dbMocks.findMany.mockResolvedValue([
      {
        id: "audit-1",
        createdAt: new Date("2026-07-21T06:00:00.000Z"),
        action: "ORGANIZATION_UPDATED",
        targetType: "organization",
        targetId: "org-1",
        before: { isActive: true },
        after: { isActive: false },
        metadata: null,
        actor: { name: "Platform Admin" },
      },
    ]);

    const result =
      await listPlatformAdminAuditEventsForOrganization("org-1", 15);

    expect(dbMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
        take: 15,
      }),
    );
    expect(result[0]).toMatchObject({
      actorName: "Platform Admin",
      createdAt: "2026-07-21T06:00:00.000Z",
    });
  });

  it("supports nullable public actors and vendor-scoped onboarding events", async () => {
    dbMocks.create.mockResolvedValue({ id: "audit-2" });

    await createPlatformAdminAuditEvent({
      actorAdminId: null,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.VENDOR_REGISTRATION_SUBMITTED,
      targetType: "vendor",
      targetId: "vendor-1",
      before: { status: "INVITED", mobile: "must-not-be-recorded" },
      after: { status: "PENDING", email: "must-not-be-recorded" },
      metadata: { token: "must-not-be-recorded" },
    } as never);

    expect(dbMocks.create).toHaveBeenCalledWith({
      data: {
        actorAdminId: null,
        organizationId: null,
        action: "VENDOR_REGISTRATION_SUBMITTED",
        targetType: "vendor",
        targetId: "vendor-1",
        before: { status: "INVITED" },
        after: { status: "PENDING" },
        metadata: undefined,
      },
    });
    expect(JSON.stringify(dbMocks.create.mock.calls[0])).not.toContain(
      "must-not-be-recorded",
    );

    dbMocks.findMany.mockResolvedValue([]);
    await listPlatformAdminAuditEventsForVendor("vendor-1", 8);
    expect(dbMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { targetType: "vendor", targetId: "vendor-1" },
        take: 8,
      }),
    );
  });
});
