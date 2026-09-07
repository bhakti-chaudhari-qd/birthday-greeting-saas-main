import { cookies } from "next/headers";
import { VendorOnboardingStatus } from "@prisma/client";

import { prisma } from "@/lib/db";

import {
  SESSION_MAX_AGE_SECONDS,
  VENDOR_SESSION_COOKIE_NAME,
} from "./constants";
import { generateSessionToken, hashSessionToken } from "./session-token";

function getSessionExpiryDate(): Date {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
}

export type VendorAuthContext = {
  vendorUserId: string;
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  referralCode: string;
  email: string | null;
  name: string;
};

export class VendorSessionCreationError extends Error {
  constructor() {
    super("Vendor is unavailable for sign-in");
    this.name = "VendorSessionCreationError";
  }
}

export async function createVendorSession(
  vendorUserId: string,
  vendorId: string,
) {
  const rawToken = generateSessionToken();
  const sessionId = hashSessionToken(rawToken);
  const expiresAt = getSessionExpiryDate();

  await prisma.$transaction(async (tx) => {
    const lockedVendors = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Vendor"
      WHERE "id" = ${vendorId}
      FOR UPDATE
    `;
    if (lockedVendors.length !== 1) {
      throw new VendorSessionCreationError();
    }

    const vendorUser = await tx.vendorUser.findFirst({
      where: { id: vendorUserId, vendorId },
      include: { vendor: true },
    });
    if (
      !vendorUser ||
      !vendorUser.isActive ||
      !vendorUser.vendor.isActive ||
      vendorUser.vendor.onboardingStatus !== VendorOnboardingStatus.APPROVED
    ) {
      throw new VendorSessionCreationError();
    }

    await tx.vendorSession.create({
      data: {
        id: sessionId,
        vendorUserId,
        vendorId,
        expiresAt,
      },
    });
  });

  const cookieStore = await cookies();
  cookieStore.set(VENDOR_SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return { expiresAt };
}

export async function destroyVendorSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(VENDOR_SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    const sessionId = hashSessionToken(rawToken);
    await prisma.vendorSession.deleteMany({
      where: { id: sessionId },
    });
  }

  cookieStore.set(VENDOR_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}

export async function getVendorAuthContext(): Promise<VendorAuthContext | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(VENDOR_SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const sessionId = hashSessionToken(rawToken);
  const session = await prisma.vendorSession.findUnique({
    where: { id: sessionId },
    include: {
      vendorUser: {
        include: { vendor: true },
      },
    },
  });

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  const { vendorUser } = session;
  if (
    !vendorUser.isActive ||
    !vendorUser.vendor.isActive ||
    vendorUser.vendor.onboardingStatus !== VendorOnboardingStatus.APPROVED
  ) {
    return null;
  }

  if (session.vendorId !== vendorUser.vendorId) {
    return null;
  }

  return {
    vendorUserId: vendorUser.id,
    vendorId: vendorUser.vendorId,
    vendorName: vendorUser.vendor.name,
    vendorSlug: vendorUser.vendor.slug,
    referralCode: vendorUser.vendor.referralCode,
    email: vendorUser.email,
    name: vendorUser.name,
  };
}
