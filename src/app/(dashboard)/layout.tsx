import { redirect } from "next/navigation";

import { AppShell } from "@/components/dashboard/app-shell";
import { HelpChatWidget } from "@/components/help/help-chat-widget";
import { ToastProvider } from "@/components/ui/toast";
import { getAuthContext } from "@/lib/auth/context";
import {
  ORGANIZATION_PORTAL_LABEL,
  getOrganizationRoleLabel,
} from "@/lib/auth/org-role-labels";
import { getDashboardNavForRole } from "@/lib/dashboard/navigation";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/login");
  }

  return (
    <AppShell
      user={{
        name: auth.name,
        email: auth.email,
        roleLabel: getOrganizationRoleLabel(auth.role),
      }}
      nav={getDashboardNavForRole(auth.role)}
      portalLabel={ORGANIZATION_PORTAL_LABEL}
      showSignOutEverywhere={auth.role === UserRole.ADMIN}
    >
      <ToastProvider>
        {children}
        <HelpChatWidget />
      </ToastProvider>
    </AppShell>
  );
}
