import { requireDashboardAdmin } from "@/lib/auth/dashboard-guard";

export const dynamic = "force-dynamic";

/** Channel, DLT, and automation settings are ADMIN-only. */
export default async function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireDashboardAdmin();
  return children;
}
