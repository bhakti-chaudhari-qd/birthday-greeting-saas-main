import { cookies } from "next/headers";

import { prisma } from "@/lib/db";

import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "./constants";
import { generateSessionToken, hashSessionToken } from "./session-token";

function getSessionExpiryDate(): Date {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
}

export async function createSessionRecord(userId: string, organizationId: string) {
  const rawToken = generateSessionToken();
  const sessionId = hashSessionToken(rawToken);
  const expiresAt = getSessionExpiryDate();

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      organizationId,
      expiresAt,
    },
  });

  return { rawToken, sessionId, expiresAt };
}

export async function createSession(userId: string, organizationId: string) {
  const { rawToken, expiresAt } = await createSessionRecord(
    userId,
    organizationId,
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return { expiresAt };
}

export async function destroySessionRecord(sessionId: string) {
  await prisma.session.deleteMany({
    where: { id: sessionId },
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    const sessionId = hashSessionToken(rawToken);
    await prisma.session.deleteMany({
      where: { id: sessionId },
    });
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}

/** Revoke every session for a user (Owner “sign out everywhere”). */
export async function destroyAllSessionsForUser(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { userId },
  });
  return result.count;
}

/** Clear the current browser cookie after revoking all sessions. */
export async function destroyAllSessionsAndClearCookie(userId: string): Promise<void> {
  await destroyAllSessionsForUser(userId);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}

export async function getSessionByToken(rawToken: string) {
  const sessionId = hashSessionToken(rawToken);

  return prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        include: {
          organization: true,
        },
      },
    },
  });
}
