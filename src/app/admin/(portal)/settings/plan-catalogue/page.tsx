import { PlanCatalogueEditor } from "@/components/admin/plan-catalogue-editor";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";
import { listPlanCatalogueEntriesForPlatformAdmin } from "@/lib/admin/plan-catalogue-ops";

export const dynamic = "force-dynamic";

export default async function AdminPlanCataloguePage() {
  const entries = await listPlanCatalogueEntriesForPlatformAdmin();

  return (
    <PageShell>
      <PageHeader
        title="Plan catalogue"
        description="Edit STARTER/PRO pricing and limits offered to new checkouts and signups."
      />
      <Panel>
        <div className="border-b border-stone-200 px-5 py-3 sm:px-6">
          <p className="text-sm text-stone-600">
            Changes apply going forward only — clients already on
            STARTER or PRO keep their existing contact/message limits
            unchanged. A plan whose Razorpay price is pinned via{" "}
            <code>RAZORPAY_PLAN_STARTER</code>/<code>RAZORPAY_PLAN_PRO</code>{" "}
            is flagged below — editing the amount there changes limits and
            display only, not what Razorpay actually charges.
          </p>
        </div>
        <PlanCatalogueEditor entries={entries} />
      </Panel>
    </PageShell>
  );
}
