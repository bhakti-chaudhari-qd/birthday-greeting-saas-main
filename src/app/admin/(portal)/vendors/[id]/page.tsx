import { notFound } from "next/navigation";

import { AdminVendorDetailClient } from "@/components/admin/admin-vendor-detail-client";
import { listPlatformAdminAuditEventsForVendor } from "@/lib/admin/audit";
import { getVendorForPlatformAdmin } from "@/lib/admin/vendors";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  /** inviteIssue: set by CreateVendorForm when the vendor was created but the
   * invitation SMS failed or its delivery is uncertain - surfaced here as a
   * banner instead of letting that redirect look like a silent success. */
  searchParams: Promise<{ inviteIssue?: string }>;
};

export default async function AdminVendorDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { inviteIssue } = await searchParams;
  const [vendor, auditEvents] = await Promise.all([
    getVendorForPlatformAdmin(id),
    listPlatformAdminAuditEventsForVendor(id, 12),
  ]);
  if (!vendor) {
    notFound();
  }

  return (
    <AdminVendorDetailClient
      vendor={vendor}
      auditEvents={auditEvents}
      inviteIssue={inviteIssue}
    />
  );
}
