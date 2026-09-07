import { UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getAuthContextFromRawToken } from "@/lib/auth/context";
import {
  ACCOUNT_DEACTIVATED_MESSAGE,
  CLIENT_LANDING_PATH,
  INVALID_CREDENTIALS_MESSAGE,
} from "@/lib/auth/constants";
import { authenticateUser } from "@/lib/auth/login";
import { verifyPassword } from "@/lib/auth/password";
import {
  AuthenticationError,
  AuthorizationError,
} from "@/lib/auth/permissions";
import {
  RegistrationError,
  createRegisteredOrganization,
} from "@/lib/auth/register";
import {
  createSessionRecord,
  destroySessionRecord,
  getSessionByToken,
} from "@/lib/auth/session";
import { hashSessionToken } from "@/lib/auth/session-token";
import { authenticateUnifiedUser } from "@/lib/auth/unified-login";
import { resolveTrustedOrganizationIdFromAuth } from "@/lib/tenant/trusted-context";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;


function buildRegisterInput(suffix: string) {
  return {
    organizationName: `Auth Org ${suffix}`,
    organizationSlug: `auth-org-${suffix}`,
    timezone: "UTC",
    adminName: "Auth Admin",
    email: `auth-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({
    where: { id: organizationId },
  });
}

describe("authentication and tenant context", () => {
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

  it("registers an organization, admin user, and hashed password", async ({
    skip,
  }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffix = uniqueSuffix();
    const input = buildRegisterInput(suffix);
    const result = await createRegisteredOrganization(input);

    const storedUser = await prisma.user.findUnique({
      where: { id: result.user.id },
    });

    expect(result.organization.slug).toBe(input.organizationSlug);
    expect(result.user.role).toBe(UserRole.ADMIN);
    expect(storedUser?.passwordHash).not.toBe(input.password);
    expect(
      await verifyPassword(input.password, storedUser!.passwordHash),
    ).toBe(true);

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: result.organization.id },
    });
    expect(subscription).not.toBeNull();

    await cleanupOrganization(result.organization.id);
  });

  it("creates organization and admin atomically in a transaction", async ({
    skip,
  }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffix = uniqueSuffix();
    const input = buildRegisterInput(suffix);
    const result = await createRegisteredOrganization(input);

    const org = await prisma.organization.findUnique({
      where: { id: result.organization.id },
      include: { users: true, subscription: true },
    });

    expect(org?.users).toHaveLength(1);
    expect(org?.subscription).not.toBeNull();

    await cleanupOrganization(result.organization.id);
  });

  it("allocates a unique slug when the preferred slug is taken", async ({
    skip,
  }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffix = uniqueSuffix();
    const input = buildRegisterInput(suffix);
    const first = await createRegisteredOrganization(input);

    const second = await createRegisteredOrganization({
      ...input,
      email: `other-${input.email}`,
    });

    expect(second.organization.slug).not.toBe(first.organization.slug);
    expect(second.organization.slug.startsWith(input.organizationSlug)).toBe(
      true,
    );

    await cleanupOrganization(first.organization.id);
    await cleanupOrganization(second.organization.id);
  });

  it("rejects duplicate email registration", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffix = uniqueSuffix();
    const input = buildRegisterInput(suffix);
    const first = await createRegisteredOrganization(input);

    await expect(
      createRegisteredOrganization({
        ...input,
        organizationSlug: `other-${input.organizationSlug}`,
      }),
    ).rejects.toBeInstanceOf(RegistrationError);

    await cleanupOrganization(first.organization.id);
  });

  it("authenticates a valid user", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffix = uniqueSuffix();
    const input = buildRegisterInput(suffix);
    const registered = await createRegisteredOrganization(input);

    const user = await authenticateUser({
      email: input.email,
      password: input.password,
    });

    expect(user.id).toBe(registered.user.id);

    await cleanupOrganization(registered.organization.id);
  });

  it("routes organization users through unified sign in", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffix = uniqueSuffix();
    const input = buildRegisterInput(suffix);
    const registered = await createRegisteredOrganization(input);

    const result = await authenticateUnifiedUser({
      email: input.email,
      password: input.password,
    });

    expect(result.portal).toBe("client");
    expect(result.redirectTo).toBe(CLIENT_LANDING_PATH);
    expect(result.user.id).toBe(registered.user.id);
    expect(result.user.organizationId).toBe(registered.organization.id);

    await cleanupOrganization(registered.organization.id);
  });

  it("rejects invalid passwords with a generic error", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffix = uniqueSuffix();
    const input = buildRegisterInput(suffix);
    const registered = await createRegisteredOrganization(input);

    await expect(
      authenticateUser({
        email: input.email,
        password: "wrong-password",
      }),
    ).rejects.toMatchObject({
      message: INVALID_CREDENTIALS_MESSAGE,
    });

    await cleanupOrganization(registered.organization.id);
  });

  it("rejects unknown emails with the same generic error", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
    }

    await expect(
      authenticateUser({
        email: "missing-user@test.local",
        password: "password12345",
      }),
    ).rejects.toMatchObject({
      message: INVALID_CREDENTIALS_MESSAGE,
    });
  });

  it("rejects inactive organizations with Account Deactivated", async ({
    skip,
  }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffix = uniqueSuffix();
    const input = buildRegisterInput(suffix);
    const registered = await createRegisteredOrganization(input);

    await prisma.organization.update({
      where: { id: registered.organization.id },
      data: { isActive: false },
    });

    await expect(
      authenticateUser({
        email: input.email,
        password: input.password,
      }),
    ).rejects.toMatchObject({
      message: ACCOUNT_DEACTIVATED_MESSAGE,
    });

    await expect(
      authenticateUnifiedUser({
        identifier: input.email,
        password: input.password,
      }),
    ).rejects.toMatchObject({
      message: ACCOUNT_DEACTIVATED_MESSAGE,
    });

    await cleanupOrganization(registered.organization.id);
  });

  it("keeps a generic error for inactive orgs when the password is wrong", async ({
    skip,
  }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffix = uniqueSuffix();
    const input = buildRegisterInput(suffix);
    const registered = await createRegisteredOrganization(input);

    await prisma.organization.update({
      where: { id: registered.organization.id },
      data: { isActive: false },
    });

    await expect(
      authenticateUser({
        email: input.email,
        password: "wrong-password",
      }),
    ).rejects.toMatchObject({
      message: INVALID_CREDENTIALS_MESSAGE,
    });

    await cleanupOrganization(registered.organization.id);
  });

  it("stores only a hashed session token in the database", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffix = uniqueSuffix();
    const registered = await createRegisteredOrganization(
      buildRegisterInput(suffix),
    );
    const { rawToken, sessionId } = await createSessionRecord(
      registered.user.id,
      registered.organization.id,
    );

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    expect(session?.id).toBe(hashSessionToken(rawToken));
    expect(session?.id).not.toBe(rawToken);

    await cleanupOrganization(registered.organization.id);
  });

  it("returns trusted auth context from a valid session", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffix = uniqueSuffix();
    const registered = await createRegisteredOrganization(
      buildRegisterInput(suffix),
    );
    const { rawToken } = await createSessionRecord(
      registered.user.id,
      registered.organization.id,
    );

    const auth = await getAuthContextFromRawToken(rawToken);

    expect(auth).toEqual({
      userId: registered.user.id,
      organizationId: registered.organization.id,
      role: UserRole.ADMIN,
      email: registered.user.email,
      name: registered.user.name,
    });

    await cleanupOrganization(registered.organization.id);
  });

  it("rejects expired sessions", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffix = uniqueSuffix();
    const registered = await createRegisteredOrganization(
      buildRegisterInput(suffix),
    );
    const { rawToken, sessionId } = await createSessionRecord(
      registered.user.id,
      registered.organization.id,
    );

    await prisma.session.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const auth = await getAuthContextFromRawToken(rawToken);
    expect(auth).toBeNull();

    await cleanupOrganization(registered.organization.id);
  });

  it("invalidates sessions on logout", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffix = uniqueSuffix();
    const registered = await createRegisteredOrganization(
      buildRegisterInput(suffix),
    );
    const { rawToken, sessionId } = await createSessionRecord(
      registered.user.id,
      registered.organization.id,
    );

    await destroySessionRecord(sessionId);

    const session = await getSessionByToken(rawToken);
    expect(session).toBeNull();

    await cleanupOrganization(registered.organization.id);
  });

  it("allows ADMIN authorization", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffix = uniqueSuffix();
    const registered = await createRegisteredOrganization(
      buildRegisterInput(suffix),
    );
    const { rawToken } = await createSessionRecord(
      registered.user.id,
      registered.organization.id,
    );

    const auth = await getAuthContextFromRawToken(rawToken);
    expect(auth).not.toBeNull();

    const adminCheck = async () => {
      if (!auth) {
        throw new AuthenticationError();
      }
      if (auth.role !== UserRole.ADMIN) {
        throw new AuthorizationError();
      }
      return auth;
    };

    await expect(adminCheck()).resolves.toMatchObject({
      role: UserRole.ADMIN,
    });

    await cleanupOrganization(registered.organization.id);
  });

  it("denies ADMIN-only authorization for STAFF users", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffix = uniqueSuffix();
    const registered = await createRegisteredOrganization(
      buildRegisterInput(suffix),
    );

    const staff = await prisma.user.create({
      data: {
        organizationId: registered.organization.id,
        email: `staff-${suffix}@test.local`,
        passwordHash: registered.user.passwordHash,
        name: "Staff User",
        role: UserRole.STAFF,
      },
    });

    const staffAuth = {
      userId: staff.id,
      organizationId: registered.organization.id,
      role: staff.role,
      email: staff.email,
      name: staff.name,
    };

    const assertAdminRole = (role: UserRole) => {
      if (role !== UserRole.ADMIN) {
        throw new AuthorizationError();
      }
    };

    await expect(async () => assertAdminRole(staffAuth.role)).rejects.toBeInstanceOf(
      AuthorizationError,
    );

    await cleanupOrganization(registered.organization.id);
  });

  it("ignores client-supplied organizationId when resolving trusted context", async ({
    skip,
  }) => {
    if (!databaseAvailable) {
      skip();
    }

    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const orgA = await createRegisteredOrganization(buildRegisterInput(suffixA));
    const orgB = await createRegisteredOrganization(buildRegisterInput(suffixB));
    const { rawToken } = await createSessionRecord(
      orgA.user.id,
      orgA.organization.id,
    );

    const auth = await getAuthContextFromRawToken(rawToken);
    expect(auth?.organizationId).toBe(orgA.organization.id);

    const resolved = resolveTrustedOrganizationIdFromAuth(
      auth!,
      orgB.organization.id,
    );

    expect(resolved).toBe(orgA.organization.id);
    expect(resolved).not.toBe(orgB.organization.id);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });
});
