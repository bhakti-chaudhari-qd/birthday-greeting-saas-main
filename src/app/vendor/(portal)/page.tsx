import Link from "next/link";
import { redirect } from "next/navigation";

import { PortalStatGrid } from "@/components/portal/portal-stat-grid";
import { StatusBadge } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  PrimaryButtonLink,
} from "@/components/ui/page";
import { CopyReferralLinkButton } from "@/components/vendor/copy-referral-link-button";
import { getVendorAuthContext } from "@/lib/auth/vendor-session";
import { getVendorDeliveryInsights } from "@/lib/vendor/insights";
import { getVendorReferredOrganizations } from "@/lib/vendor/referrals";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export default async function VendorHomePage() {
  const vendor = await getVendorAuthContext();
  if (!vendor) {
    redirect("/login");
  }

  const [insights, referred] = await Promise.all([
    getVendorDeliveryInsights(vendor.vendorId),
    getVendorReferredOrganizations(vendor.vendorId),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Overview"
        description={`Current-routed delivery activity for organizations with active ${vendor.vendorName} channel connections. Contact lists stay in the Organization portal.`}
        actions={
          <PrimaryButtonLink href="/vendor/insights">
            Delivery insights
          </PrimaryButtonLink>
        }
      />

      <Panel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">
              Your referral code
            </h2>
            <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-stone-900">
              {vendor.referralCode}
            </p>
            <p className="mt-1 text-sm text-stone-500">
              Share this code or signup link so new organizations attribute to
              you.
            </p>
          </div>
          <CopyReferralLinkButton referralCode={vendor.referralCode} />
        </div>
      </Panel>

      <PortalStatGrid
        stats={[
          {
            label: "Referred clients",
            value: formatNumber(referred.length),
            hint: "Signed up with your code",
          },
          {
            label: "Current active connections",
            value: formatNumber(
              insights.currentActiveConnectedOrganizationCount,
            ),
            hint: "Organizations with active channel routing",
          },
          {
            label: "Current-routed deliveries today",
            value: formatNumber(insights.currentRoutedDeliveriesToday),
            hint: "Current active routes; UTC day",
          },
          {
            label: "Current-routed deliveries this month",
            value: formatNumber(insights.currentRoutedDeliveriesThisMonth),
            hint: "Current active routes; UTC calendar month",
          },
        ]}
      />

      <Panel className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-stone-900">
            Recent referred clients
          </h2>
          <Link
            href="/vendor/referrals"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {referred.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">
            No organizations have used your referral code yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {referred.slice(0, 5).map((org) => (
              <li
                key={org.id}
                className="flex items-center justify-between gap-3 border-b border-stone-100 pb-2 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-stone-900">{org.name}</p>
                  <p className="text-xs text-stone-500">
                    {org.ownerEmail ?? org.slug}
                  </p>
                </div>
                <StatusBadge
                  label={org.isActive ? "Active" : "Inactive"}
                  tone={org.isActive ? "success" : "neutral"}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-stone-900">
            Current active connections
          </h2>
          <Link
            href="/vendor/insights"
            className="text-sm font-medium text-primary hover:underline"
          >
            Delivery insights
          </Link>
        </div>
        {insights.currentActiveConnectedOrganizations.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">
            No organizations are routed to this vendor yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {insights.currentActiveConnectedOrganizations.map((org) => (
              <li
                key={org.id}
                className="flex items-center justify-between gap-3 border-b border-stone-100 pb-2 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-stone-900">{org.name}</p>
                  <p className="text-xs text-stone-500">
                    {org.slug} · {org.channels.join(", ")}
                  </p>
                </div>
                <StatusBadge
                  label={org.isActive ? "Active" : "Inactive"}
                  tone={org.isActive ? "success" : "neutral"}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageShell>
  );
}
