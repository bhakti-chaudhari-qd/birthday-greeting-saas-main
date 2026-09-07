import { cookies } from "next/headers";

import { prisma } from "@/lib/db";

import {
  ADMIN_SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "./constants";
import { generateSessionToken, hashSessionToken } from "./session-token";

function getSessionExpiryDate(): Date {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
}

export type PlatformAdminContext = {
  adminId: string;
  email: string;
  name: string;
};

export async function createPlatformAdminSession(adminId: string) {
  const rawToken = generateSessionToken();
  const sessionId = hashSessionToken(rawToken);
  const expiresAt = getSessionExpiryDate();

  await prisma.platformAdminSession.create({
    data: {
      id: sessionId,
      adminId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return { expiresAt };
}

export async function destroyPlatformAdminSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    const sessionId = hashSessionToken(rawToken);
    await prisma.platformAdminSession.deleteMany({
      where: { id: sessionId },
    });
  }

  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}

export async function getPlatformAdminContext(): Promise<PlatformAdminContext | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const sessionId = hashSessionToken(rawToken);
  const session = await prisma.platformAdminSession.findUnique({
    where: { id: sessionId },
    include: { admin: true },
  });

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (!session.admin.isActive) {
    return null;
  }

  return {
    adminId: session.admin.id,
    email: session.admin.email,
    name: session.admin.name,
  };
}
