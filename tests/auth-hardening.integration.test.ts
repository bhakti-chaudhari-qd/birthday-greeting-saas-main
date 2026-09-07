import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthTokenPurpose } from "@prisma/client";

import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as resetPasswordRoute } from "@/app/api/auth/reset-password/route";
import {
  PASSWORD_RESET_TTL_MS,
  consumeAuthToken,
  issueAuthToken,
} from "@/lib/auth/auth-tokens";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createSessionRecord } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

describe("auth hardening (REQ-AUTH)", () => {
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

  it("returns 429 after repeated failed logins", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization({
      organizationName: `Auth RL ${suffix}`,
      organizationSlug: `auth-rl-${suffix}`,
      timezone: "UTC",
      adminName: "Owner",
      email: `auth-rl-${suffix}@test.local`,
      password: "password12345",
    });

    try {
      let lastStatus = 0;
      for (let i = 0; i < 6; i += 1) {
        const response = await loginRoute(
          new Request("http://localhost/api/auth/login", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-forwarded-for": `203.0.113.${suffix.slice(-2) || "10"}`,
            },
            body: JSON.stringify({
              email: org.user.email,
              password: "wrong-password-here",
            }),
          }),
        );
        lastStatus = response.status;
      }

      expect(lastStatus).toBe(429);
    } finally {
      await prisma.organization.delete({ where: { id: org.organization.id } });
      await prisma.authRateLimit.deleteMany({
        where: { bucketKey: { contains: org.user.email } },
      });
    }
  });

  it("password reset token is single-use and expires-aware", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization({
      organizationName: `Reset ${suffix}`,
      organizationSlug: `reset-${suffix}`,
      timezone: "UTC",
      adminName: "Owner",
      email: `reset-${suffix}@test.local`,
      password: "password12345",
    });

    try {
      const rawToken = await issueAuthToken({
        userId: org.user.id,
        purpose: AuthTokenPurpose.PASSWORD_RESET,
        ttlMs: PASSWORD_RESET_TTL_MS,
      });

      const first = await resetPasswordRoute(
        new Request("http://localhost/api/auth/reset-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token: rawToken,
            password: "NewPassword99",
          }),
        }),
      );
      expect(first.status).toBe(200);

      const second = await resetPasswordRoute(
        new Request("http://localhost/api/auth/reset-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token: rawToken,
            password: "AnotherPass99",
          }),
        }),
      );
      expect(second.status).toBe(400);

      const expiredRaw = await issueAuthToken({
        userId: org.user.id,
        purpose: AuthTokenPurpose.PASSWORD_RESET,
        ttlMs: PASSWORD_RESET_TTL_MS,
      });
      await prisma.authToken.updateMany({
        where: { userId: org.user.id, purpose: AuthTokenPurpose.PASSWORD_RESET },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const expired = await consumeAuthToken({
        rawToken: expiredRaw,
        purpose: AuthTokenPurpose.PASSWORD_RESET,
      });
      expect(expired).toBeNull();
    } finally {
      await prisma.organization.delete({ where: { id: org.organization.id } });
    }
  });

  it("Owner can revoke all sessions", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization({
      organizationName: `Sessions ${suffix}`,
      organizationSlug: `sessions-${suffix}`,
      timezone: "UTC",
      adminName: "Owner",
      email: `sessions-${suffix}@test.local`,
      password: "password12345",
    });

    const sessionA = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );
    const sessionB = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );

    const { destroyAllSessionsForUser } = await import("@/lib/auth/session");
    const removed = await destroyAllSessionsForUser(org.user.id);
    expect(removed).toBeGreaterThanOrEqual(2);

    const remaining = await prisma.session.count({
      where: { userId: org.user.id },
    });
    expect(remaining).toBe(0);
    expect(sessionA.sessionId).not.toEqual(sessionB.sessionId);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });
});
