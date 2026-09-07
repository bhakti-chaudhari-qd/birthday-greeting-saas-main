import { OccasionsPageClient } from "@/components/occasions/occasions-page-client";
import { requireDashboardAdmin } from "@/lib/auth/dashboard-guard";

export const dynamic = "force-dynamic";

export default async function OccasionManagementPage() {
  await requireDashboardAdmin();

  return <OccasionsPageClient />;
}
