import { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { lockAndCheckPrincipalEmail } from "@/lib/auth/principal-email";
import { createSession } from "@/lib/auth/session";
import { ensureDefaultContactCategories } from "@/lib/contacts/categories";
import type { RegisterInput } from "@/lib/validation/auth";

export class RegistrationError extends Error {
  constructor(
    message: string,
    readonly code: "VALIDATION" | "CONFLICT",
  ) {
    super(message);
    this.name = "RegistrationError";
  }
}

const DEFAULT_ORGANIZATION_TIMEZONE = "Asia/Kolkata";

/** Build a URL-safe slug from an organization display name. */
export function slugifyOrganizationName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  if (base.length >= 2) {
    return base;
  }

  return `org-${Date.now().toString(36)}`;
}

async function allocateUniqueOrganizationSlug(
  tx: Prisma.TransactionClient,
  preferredSlug: string,
): Promise<string> {
  const base = preferredSlug.slice(0, 50);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate =
      attempt === 0
        ? base
        : `${base.slice(0, Math.max(2, 50 - 5))}-${Math.random()
            .toString(36)
            .slice(2, 6)}`;

    const existing = await tx.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }

  throw new RegistrationError(
    "Could not allocate a unique organization slug",
    "CONFLICT",
  );
}

export type CreateRegisteredOrganizationOptions = {
  referredByVendorId?: string | null;
};

export async function createRegisteredOrganization(
  input: RegisterInput,
  options: CreateRegisteredOrganizationOptions = {},
) {
  const passwordHash = await hashPassword(input.password);
  const preferredSlug =
    input.organizationSlug?.trim() ||
    slugifyOrganizationName(input.organizationName);
  const timezone = input.timezone?.trim() || DEFAULT_ORGANIZATION_TIMEZONE;
  const referredByVendorId = options.referredByVendorId?.trim() || null;

  try {
    return await prisma.$transaction(async (tx) => {
      const slug = await allocateUniqueOrganizationSlug(tx, preferredSlug);
      const principalEmail = await lockAndCheckPrincipalEmail(tx, input.email);
      if (!principalEmail.available) {
        throw new RegistrationError(
          "An account with this email already exists",
          "CONFLICT",
        );
      }

      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug,
          timezone,
          referredByVendorId: referredByVendorId ?? undefined,
          referredAt: referredByVendorId ? new Date() : undefined,
          subscription: {
            create: {
              contactLimit: 500,
              monthlyMessageLimit: 500,
            },
          },
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: principalEmail.normalizedEmail,
          passwordHash,
          name: input.adminName,
          role: UserRole.ADMIN,
        },
      });

      await ensureDefaultContactCategories(organization.id, tx);

      return { organization, user };
    });
  } catch (error) {
    if (error instanceof RegistrationError) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(",")
        : String(error.meta?.target ?? "");

      if (target.includes("slug")) {
        throw new RegistrationError(
          "An organization with this slug already exists",
          "CONFLICT",
        );
      }

      if (target.includes("email")) {
        throw new RegistrationError(
          "An account with this email already exists",
          "CONFLICT",
        );
      }

      throw new RegistrationError("Registration conflict", "CONFLICT");
    }

    throw error;
  }
}

export async function registerOrganization(
  input: RegisterInput,
  options: CreateRegisteredOrganizationOptions = {},
) {
  const result = await createRegisteredOrganization(input, options);

  await createSession(result.user.id, result.organization.id);

  return {
    organization: {
      id: result.organization.id,
      name: result.organization.name,
      slug: result.organization.slug,
    },
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
    },
  };
}
