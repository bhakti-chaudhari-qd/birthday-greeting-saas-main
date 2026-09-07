import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { UserRole } from "@prisma/client";

import {
  GET as getSmsChannelConfigRoute,
  PUT as putSmsChannelConfigRoute,
} from "@/app/api/v1/channel-config/sms/route";
import  { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createSessionRecord } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

async function mockSessionCookie(rawToken: string) {
  const { cookies } = await import("next/headers");

  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME ? { value: rawToken } : undefined,
    set: vi.fn(),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

describe("customer RBAC (REQ-RBAC)", () => {
  beforeAll(async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_CREDENTIALS_ENCRYPTION_KEY;

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

  it("returns 403 when STAFF PUT SMS channel config; ADMIN succeeds", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization({
      organizationName: `RBAC Org ${suffix}`,
      organizationSlug: `rbac-org-${suffix}`,
      timezone: "UTC",
      adminName: "RBAC Admin",
      email: `rbac-admin-${suffix}@test.local`,
      password: "password12345",
    });

    const staff = await prisma.user.create({
      data: {
        organizationId: org.organization.id,
        email: `rbac-staff-${suffix}@test.local`,
        name: "RBAC Staff",
        role: UserRole.STAFF,
        passwordHash: org.user.passwordHash,
      },
    });

    const smsBody = {
      provider: "TEST",
      isActive: true,
    };

    try {
      const staffSession = await createSessionRecord(
        staff.id,
        org.organization.id,
      );
      await mockSessionCookie(staffSession.rawToken);

      const staffResponse = await putSmsChannelConfigRoute(
        new Request("http://localhost/api/v1/channel-config/sms", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(smsBody),
        }),
      );
      expect(staffResponse.status).toBe(403);
      const staffJson = await staffResponse.json();
      expect(staffJson.error.message).toBe("Forbidden");

      const adminSession = await createSessionRecord(
        org.user.id,
        org.organization.id,
      );
      await mockSessionCookie(adminSession.rawToken);

      const adminResponse = await putSmsChannelConfigRoute(
        new Request("http://localhost/api/v1/channel-config/sms", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(smsBody),
        }),
      );
      expect(adminResponse.status).toBe(200);

      const staffGet = await (async () => {
        await mockSessionCookie(staffSession.rawToken);
        return getSmsChannelConfigRoute();
      })();
      expect(staffGet.status).toBe(403);
    } finally {
      await prisma.organization.delete({ where: { id: org.organization.id } });
    }
  });
});
