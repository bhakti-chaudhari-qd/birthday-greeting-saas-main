import { UserRole } from "@prisma/client";

import { getAuthContext } from "./context";
import type { AuthContext } from "./types";

export class AuthenticationError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuthContext();

  if (!auth) {
    throw new AuthenticationError();
  }

  return auth;
}

export async function requireRole(role: UserRole): Promise<AuthContext> {
  const auth = await requireAuth();

  if (auth.role !== role) {
    throw new AuthorizationError();
  }

  return auth;
}

export async function requireAdmin(): Promise<AuthContext> {
  return requireRole(UserRole.ADMIN);
}
