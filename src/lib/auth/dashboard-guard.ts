import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/context";
import type { AuthContext } from "@/lib/auth/types";

/**
 * Ensures the customer session is an org ADMIN.
 * Unauthenticated → /login; STAFF → /dashboard.
 */
export async function requireDashboardAdmin(): Promise<AuthContext> {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/login");
  }

  if (auth.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  return auth;
}
