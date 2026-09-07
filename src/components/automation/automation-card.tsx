"use client";

import { StatusBadge } from "@/components/ui/feedback";
import { compactSecondaryButtonClass } from "@/components/ui/page";

import type { AutomationCardData } from "./types";

export type AutomationCardProps = {
  automation: AutomationCardData;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  busy?: boolean;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-stone-800">{value}</dd>
    </div>
  );
}

export function AutomationCard({
  automation,
  onEdit,
  onToggle,
  onDelete,
  busy = false,
}: AutomationCardProps) {
  const isActive = automation.status === "active";
  const isDisabled = automation.status === "disabled";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-stone-200/80 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-stone-900">{automation.title}</p>
        <StatusBadge
          label={isActive ? "Active" : isDisabled ? "Disabled" : "Paused"}
          tone={isActive ? "success" : isDisabled ? "neutral" : "warning"}
        />
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
        <Field label="Occasion" value={automation.occasionLabel} />
        <Field label="Category" value={automation.categoryName} />
        <Field label="Send Time" value={automation.sendTimeLabel} />
      </dl>

      <div>
        <p className="text-xs text-stone-500">Channels</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {automation.channels.length > 0 ? (
            automation.channels.map((channel) => (
              <span
                key={channel.channel}
                title={channel.templateName}
                className="inline-flex items-center rounded-lg bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700 ring-1 ring-inset ring-stone-200"
              >
                {channel.channelLabel}
              </span>
            ))
          ) : (
            <span className="text-xs text-stone-500">No channel configured</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className={compactSecondaryButtonClass}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onToggle}
          disabled={busy || isDisabled}
          className={compactSecondaryButtonClass}
        >
          {isActive ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className={`${compactSecondaryButtonClass} border-red-200 text-red-700 hover:bg-red-50`}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
