import { prisma } from "@/lib/db";
import { VendorOnboardingStatus } from "@prisma/client";

export class VendorReferralError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VendorReferralError";
  }
}

const REFERRAL_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,31}$/;

/** Normalize user/admin input to the stored referral-code form. */
export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidReferralCodeFormat(code: string): boolean {
  return REFERRAL_CODE_PATTERN.test(normalizeReferralCode(code));
}

/**
 * Optional vendor referral at signup.
 * Empty/undefined → null (no attribution).
 * Non-empty invalid or inactive vendor → VendorReferralError.
 */
export async function resolveOptionalVendorReferral(
  referralCode: string | undefined,
): Promise<string | null> {
  const raw = referralCode?.trim();
  if (!raw) {
    return null;
  }

  const code = normalizeReferralCode(raw);
  if (!isValidReferralCodeFormat(code)) {
    throw new VendorReferralError("Invalid referral code");
  }

  const vendor = await prisma.vendor.findFirst({
    where: {
      referralCode: code,
      isActive: true,
      onboardingStatus: VendorOnboardingStatus.APPROVED,
    },
    select: { id: true },
  });

  if (!vendor) {
    throw new VendorReferralError("Invalid referral code");
  }

  return vendor.id;
}
