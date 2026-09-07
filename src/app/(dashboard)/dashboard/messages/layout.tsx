import { requireDashboardAdmin } from "@/lib/auth/dashboard-guard";
import { PageShell } from "@/components/ui/page";

export const dynamic = "force-dynamic";

export default async function MessagesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireDashboardAdmin();
  return <PageShell>{children}</PageShell>;
}
