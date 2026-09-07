import { redirect } from "next/navigation";

import { AppShell } from "@/components/dashboard/app-shell";
import { VENDOR_PORTAL_LABEL } from "@/lib/auth/org-role-labels";
import { getVendorAuthContext } from "@/lib/auth/vendor-session";
import { VENDOR_HOME_HREF, VENDOR_NAV } from "@/lib/vendor/navigation";

export const dynamic = "force-dynamic";

export default async function VendorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const vendor = await getVendorAuthContext();

  if (!vendor) {
    redirect("/login");
  }

  return (
    <AppShell
      user={{ name: vendor.name, email: vendor.email ?? "Mobile sign-in" }}
      nav={VENDOR_NAV}
      homeHref={VENDOR_HOME_HREF}
      portalLabel={VENDOR_PORTAL_LABEL}
      brandTitle={vendor.vendorName}
      logoutPath="/api/auth/vendor/logout"
      loginPath="/login"
    >
      {children}
    </AppShell>
  );
}
