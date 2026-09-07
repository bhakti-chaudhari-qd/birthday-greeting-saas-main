import {
  ACCOUNT_DEACTIVATED_MESSAGE,
  ADMIN_LANDING_PATH,
  CLIENT_LANDING_PATH,
  INVALID_CREDENTIALS_MESSAGE,
  VENDOR_LANDING_PATH,
} from "@/lib/auth/constants";
import { verifyPassword } from "@/lib/auth/password";
import { createPlatformAdminSession } from "@/lib/auth/platform-admin-session";
import { createSession } from "@/lib/auth/session";
import {
  VendorSessionCreationError,
  createVendorSession,
} from "@/lib/auth/vendor-session";
import { normalizeMobile } from "@/lib/contacts/mobile";
import { prisma } from "@/lib/db";
import type {
  LoginInput,
  UnifiedLoginInput,
} from "@/lib/validation/auth";

export type UnifiedPortal = "client" | "platform-admin" | "vendor";

export type UnifiedLoginResult = {
  portal: UnifiedPortal;
  redirectTo: string;
  user: {
    id: string;
    email: string | null;
    name: string;
    role?: string;
    organizationId?: string;
    vendorId?: string;
    vendorName?: string;
  };
};

export class UnifiedLoginError extends Error {
  constructor(message = INVALID_CREDENTIALS_MESSAGE) {
    super(message);
    this.name = "UnifiedLoginError";
  }
}

async function passwordMatches(password: string, hash: string): Promise<boolean> {
  return verifyPassword(password, hash);
}

export async function loginUnifiedUser(
  input: UnifiedLoginInput | LoginInput,
): Promise<UnifiedLoginResult> {
  const result = await authenticateUnifiedUser(input);

  if (result.portal === "client") {
    await createSession(result.user.id, result.user.organizationId!);
  } else if (result.portal === "platform-admin") {
    await createPlatformAdminSession(result.user.id);
  } else {
    try {
      await createVendorSession(result.user.id, result.user.vendorId!);
    } catch (error) {
      if (error instanceof VendorSessionCreationError) {
        throw new UnifiedLoginError();
      }
      throw error;
    }
  }

  return result;
}

export async function authenticateUnifiedUser(
  input: UnifiedLoginInput | LoginInput,
): Promise<UnifiedLoginResult> {
  const identifier = (
    "identifier" in input ? input.identifier : input.email
  ).trim();
  const email = zEmail(identifier);
  const mobile = email ? null : normalizeMobile(identifier);

  const [user, platformAdmin, vendorUser] = await Promise.all([
    email
      ? prisma.user.findUnique({
          where: { email },
          include: { organization: true },
        })
      : Promise.resolve(null),
    email
      ? prisma.platformAdmin.findUnique({
          where: { email },
        })
      : Promise.resolve(null),
    prisma.vendorUser.findUnique({
      where: email ? { email } : { mobile: mobile! },
      include: { vendor: true },
    }),
  ]);

  if (user && (await passwordMatches(input.password, user.passwordHash))) {
    if (!user.isActive || !user.organization.isActive) {
      throw new UnifiedLoginError(ACCOUNT_DEACTIVATED_MESSAGE);
    }

    return {
      portal: "client",
      redirectTo: CLIENT_LANDING_PATH,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
    };
  }

  if (
    platformAdmin &&
    (await passwordMatches(input.password, platformAdmin.passwordHash))
  ) {
    if (!platformAdmin.isActive) {
      throw new UnifiedLoginError(ACCOUNT_DEACTIVATED_MESSAGE);
    }

    return {
      portal: "platform-admin",
      redirectTo: ADMIN_LANDING_PATH,
      user: {
        id: platformAdmin.id,
        email: platformAdmin.email,
        name: platformAdmin.name,
      },
    };
  }

  if (
    vendorUser &&
    vendorUser.vendor.onboardingStatus === "APPROVED" &&
    (await passwordMatches(input.password, vendorUser.passwordHash))
  ) {
    if (!vendorUser.isActive || !vendorUser.vendor.isActive) {
      throw new UnifiedLoginError(ACCOUNT_DEACTIVATED_MESSAGE);
    }

    return {
      portal: "vendor",
      redirectTo: VENDOR_LANDING_PATH,
      user: {
        id: vendorUser.id,
        email: vendorUser.email,
        name: vendorUser.name,
        vendorId: vendorUser.vendorId,
        vendorName: vendorUser.vendor.name,
      },
    };
  }

  throw new UnifiedLoginError();
}

function zEmail(identifier: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
    ? identifier.toLowerCase()
    : null;
}
