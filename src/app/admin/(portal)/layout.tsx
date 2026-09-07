import { redirect } from "next/navigation";

import { AppShell } from "@/components/dashboard/app-shell";
import { PLATFORM_ADMIN_PORTAL_LABEL } from "@/lib/auth/org-role-labels";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import { ADMIN_HOME_HREF, ADMIN_NAV } from "@/lib/admin/navigation";
import { PRODUCT_DISPLAY_NAME } from "@/lib/dashboard/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await getPlatformAdminContext();

  if (!admin) {
    redirect("/login");
  }

  return (
    <AppShell
      user={{ name: admin.name, email: admin.email }}
      nav={ADMIN_NAV}
      homeHref={ADMIN_HOME_HREF}
      portalLabel={PLATFORM_ADMIN_PORTAL_LABEL}
      brandTitle={PRODUCT_DISPLAY_NAME}
      logoutPath="/api/auth/admin/logout"
      loginPath="/login"
      compactSidebar
    >
      {children}
    </AppShell>
  );
}
