import { cookies } from "next/headers";
import { cache } from "react";

import { SESSION_COOKIE_NAME } from "./constants";
import { getSessionByToken } from "./session";
import type { AuthContext } from "./types";

function buildAuthContext(
  session: NonNullable<Awaited<ReturnType<typeof getSessionByToken>>>,
): AuthContext | null {
  if (session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  const { user } = session;

  if (!user.isActive || !user.organization.isActive) {
    return null;
  }

  if (session.organizationId !== user.organizationId) {
    return null;
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    email: user.email,
    name: user.name,
  };
}

export async function getAuthContextFromRawToken(
  rawToken: string,
): Promise<AuthContext | null> {
  const session = await getSessionByToken(rawToken);

  if (!session) {
    return null;
  }

  return buildAuthContext(session);
}

export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  return getAuthContextFromRawToken(rawToken);
});
