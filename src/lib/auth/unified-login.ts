import {
  ACCOUNT_DEACTIVATED_MESSAGE,
  ADMIN_LANDING_PATH,
  CLIENT_LANDING_PATH,
  INVALID_CREDENTIALS_MESSAGE,
  VENDOR_LANDING_PATH,
} from "@/lib/auth/constants";
import { equalizeFailedLoginTiming, verifyPassword } from "@/lib/auth/password";
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

  // Track whether any real password comparison ran, so the "no account
  // matched" path can spend the same bcrypt time instead of returning early
  // and leaking which identifiers exist.
  let comparedPassword = false;
  const matches = (passwordHash: string): Promise<boolean> => {
    comparedPassword = true;
    return passwordMatches(input.password, passwordHash);
  };

  if (user && (await matches(user.passwordHash))) {
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
    (await matches(platformAdmin.passwordHash))
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
    (await matches(vendorUser.passwordHash))
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

  if (!comparedPassword) {
    await equalizeFailedLoginTiming(input.password);
  }

  throw new UnifiedLoginError();
}

function zEmail(identifier: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
    ? identifier.toLowerCase()
    : null;
}
