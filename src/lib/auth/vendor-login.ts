import { VendorOnboardingStatus } from "@prisma/client";

import { INVALID_CREDENTIALS_MESSAGE } from "@/lib/auth/constants";
import { verifyPassword } from "@/lib/auth/password";
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

export class VendorLoginError extends Error {
  constructor(message = INVALID_CREDENTIALS_MESSAGE) {
    super(message);
    this.name = "VendorLoginError";
  }
}

export async function authenticateVendorUser(
  input: UnifiedLoginInput | LoginInput,
) {
  const identifier = (
    "identifier" in input ? input.identifier : input.email
  ).trim();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
    ? identifier.toLowerCase()
    : null;
  const mobile = email ? null : normalizeMobile(identifier);
  const vendorUser = await prisma.vendorUser.findUnique({
    where: email ? { email } : { mobile: mobile! },
    include: { vendor: true },
  });

  if (
    !vendorUser ||
    !vendorUser.isActive ||
    !vendorUser.vendor.isActive ||
    vendorUser.vendor.onboardingStatus !== VendorOnboardingStatus.APPROVED
  ) {
    throw new VendorLoginError();
  }

  const passwordValid = await verifyPassword(
    input.password,
    vendorUser.passwordHash,
  );
  if (!passwordValid) {
    throw new VendorLoginError();
  }

  return vendorUser;
}

export async function loginVendorUser(input: UnifiedLoginInput | LoginInput) {
  const vendorUser = await authenticateVendorUser(input);
  try {
    await createVendorSession(vendorUser.id, vendorUser.vendorId);
  } catch (error) {
    if (error instanceof VendorSessionCreationError) {
      throw new VendorLoginError();
    }
    throw error;
  }

  return {
    user: {
      id: vendorUser.id,
      email: vendorUser.email,
      name: vendorUser.name,
      vendorId: vendorUser.vendorId,
      vendorName: vendorUser.vendor.name,
    },
  };
}
