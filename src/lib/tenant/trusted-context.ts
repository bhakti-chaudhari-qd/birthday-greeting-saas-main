import type { AuthContext } from "@/lib/auth/types";
import { getAuthContext } from "@/lib/auth/context";
import { requireAuth } from "@/lib/auth/permissions";

export function resolveTrustedOrganizationIdFromAuth(
  auth: AuthContext,
  untrustedOrganizationId?: string,
): string {
  if (
    untrustedOrganizationId &&
    untrustedOrganizationId !== auth.organizationId
  ) {
    // Never allow client-supplied tenant identifiers to override session context.
  }

  return auth.organizationId;
}

export async function getTrustedOrganizationId(): Promise<string> {
  const auth = await requireAuth();
  return resolveTrustedOrganizationIdFromAuth(auth);
}

export async function resolveTrustedOrganizationId(
  untrustedOrganizationId?: string,
): Promise<string> {
  const auth = await getAuthContext();

  if (!auth) {
    throw new Error("Authentication required");
  }

  return resolveTrustedOrganizationIdFromAuth(auth, untrustedOrganizationId);
}
