import { requireDashboardAdmin } from "@/lib/auth/dashboard-guard";

export const dynamic = "force-dynamic";

/** Creating templates is ADMIN-only. */
export default async function NewTemplateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireDashboardAdmin();
  return children;
}
