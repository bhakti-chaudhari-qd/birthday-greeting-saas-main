type PortalStat = {
  label: string;
  value: string;
  hint?: string;
};

export function PortalStatGrid({ stats }: { stats: PortalStat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-stone-200/90 bg-white px-4 py-3 shadow-sm"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            {stat.label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">
            {stat.value}
          </p>
          {stat.hint ? (
            <p className="mt-1 text-xs text-stone-500">{stat.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
