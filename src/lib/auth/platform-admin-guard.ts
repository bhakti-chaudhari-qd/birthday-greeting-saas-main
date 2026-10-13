import { redirect } from "next/navigation";

import {
  getPlatformAdminContext,
  type PlatformAdminContext,
} from "@/lib/auth/platform-admin-session";

/**
 * Page-level Platform Admin gate. The portal layout also checks the session,
 * but Next.js does not re-run a layout on client-side navigation (Partial
 * Rendering), so a crafted RSC request can render a page without its layout.
 * Every admin page must call this in its own render - not rely on the layout -
 * so the check runs no matter how the page is reached.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const admin = await getPlatformAdminContext();

  if (!admin) {
    redirect("/login");
  }

  return admin;
}
