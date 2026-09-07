import { PageShell, Panel } from "@/components/ui/page";

function LoadingBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-stone-200 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <PageShell wide>
      <div className="space-y-3">
        <LoadingBlock className="h-8 w-56" />
        <LoadingBlock className="h-4 w-96 max-w-full" />
      </div>
      <Panel className="space-y-4 p-6">
        <LoadingBlock className="h-5 w-40" />
        <LoadingBlock className="h-24 w-full" />
        <div className="grid gap-4 sm:grid-cols-3">
          <LoadingBlock className="h-20 w-full" />
          <LoadingBlock className="h-20 w-full" />
          <LoadingBlock className="h-20 w-full" />
        </div>
      </Panel>
    </PageShell>
  );
}
