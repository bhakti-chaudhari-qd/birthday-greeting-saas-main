import { AdminVendorsListClient } from "@/components/admin/admin-vendors-list-client";
import { listVendorsForPlatformAdmin } from "@/lib/admin/vendors";

export const dynamic = "force-dynamic";

export default async function AdminVendorsPage() {
  const vendors = await listVendorsForPlatformAdmin();

  return <AdminVendorsListClient vendors={vendors} />;
}
