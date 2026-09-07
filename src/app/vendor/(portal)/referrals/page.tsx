import { redirect } from "next/navigation";

import { StatusBadge } from "@/components/ui/feedback";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";
import { getVendorAuthContext } from "@/lib/auth/vendor-session";
import { getVendorReferredOrganizations } from "@/lib/vendor/referrals";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

export const dynamic = "force-dynamic";

export default async function VendorReferralsPage() {
  const vendor = await getVendorAuthContext();
  if (!vendor) {
    redirect("/login");
  }

  const referred = await getVendorReferredOrganizations(vendor.vendorId);

  return (
    <PageShell wide>
      <PageHeader
        title="Referred clients"
        description={`Organizations that signed up with your referral code (${vendor.referralCode}). Owner contact is shown for follow-up; contact lists stay in the Organization portal.`}
      />

      <Panel>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Signed up</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {referred.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-stone-500" colSpan={5}>
                    No referred organizations yet. Share your referral code or
                    link from Overview.
                  </td>
                </tr>
              ) : (
                referred.map((org) => (
                  <tr key={org.id} className="border-b border-stone-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-900">{org.name}</p>
                      <p className="text-xs text-stone-500">{org.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      <p>{org.ownerName ?? "-"}</p>
                      <p className="text-xs text-stone-500">
                        {org.ownerEmail ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {org.plan ?? "-"}
                      {org.subscriptionStatus
                        ? ` (${org.subscriptionStatus})`
                        : ""}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {formatCustomerDateTime(org.referredAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={org.isActive ? "Active" : "Inactive"}
                        tone={org.isActive ? "success" : "neutral"}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </PageShell>
  );
}
