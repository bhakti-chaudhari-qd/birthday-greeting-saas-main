import { requireDashboardAdmin } from "@/lib/auth/dashboard-guard";

export const dynamic = "force-dynamic";

/** Manual send is ADMIN-only. */
export default async function MessagesSendLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireDashboardAdmin();
  return children;
}
