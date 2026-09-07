import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { getAuthContext } from "@/lib/auth/context";
import { getDashboardHomeSummary } from "@/lib/dashboard/home-summary";

export default async function DashboardPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect("/login");
  }

  const summary = await getDashboardHomeSummary(
    auth.organizationId,
    auth.role,
  );

  return (
    <DashboardHome
      name={auth.name}
      summary={summary}
      canManage={auth.role === UserRole.ADMIN}
    />
  );
}
