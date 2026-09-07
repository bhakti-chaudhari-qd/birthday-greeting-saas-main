import { requireDashboardAdmin } from "@/lib/auth/dashboard-guard";

export const dynamic = "force-dynamic";

/** Editing templates is ADMIN-only. */
export default async function EditTemplateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireDashboardAdmin();
  return children;
}
