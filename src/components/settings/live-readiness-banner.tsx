"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  LiveChannelReadiness,
  LiveReadinessChecklistItem,
} from "@/lib/abuse/live-readiness";
import {
  getLiveReadinessDict,
  type LiveReadinessDict,
} from "@/lib/i18n/dictionaries/live-readiness";
import { useLocale } from "@/lib/i18n/use-locale";

function itemLabel(
  item: LiveReadinessChecklistItem,
  readiness: LiveChannelReadiness,
  dict: LiveReadinessDict,
): string {
  if (item.id === "paid_plan") {
    return readiness.liveChannelsApproved ? dict.paidPlanApproved : dict.paidPlan;
  }
  if (item.id === "dlt_templates") {
    return readiness.smsTemplatesReadyForLive + readiness.smsTemplatesNeedingSetup === 0
      ? dict.dltCreate
      : dict.dltComplete;
  }
  return dict.liveProvider;
}

/**
 * Owner-only checklist of what is still needed before messages can go out.
 * Compact step cards — hidden for Staff (403) and once every step is done.
 */
export function LiveReadinessBanner({
  className,
}: {
  className?: string;
} = {}) {
  const dict = getLiveReadinessDict(useLocale());
  const [readiness, setReadiness] = useState<LiveChannelReadiness | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/v1/live-readiness");
        if (!response.ok) {
          return;
        }
        const body = await response.json();
        if (!cancelled && body.data) {
          setReadiness(body.data as LiveChannelReadiness);
        }
      } catch {
        // Optional banner - pages stay usable if this fails.
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!readiness?.checklist?.length || !readiness.showBanner) {
    return null;
  }

  return (
    <ol className={["flex flex-wrap gap-3", className ?? ""].join(" ")}>
      {readiness.checklist.map((item, index) => (
        <li
          key={item.id}
          className={[
            "min-w-[220px] flex-1 rounded-lg border px-3 py-2.5",
            item.done ? "border-emerald-200 bg-emerald-50/60" : "border-zinc-200 bg-zinc-50/50",
          ].join(" ")}
        >
          <div className="flex items-start gap-2.5">
            <span
              className={[
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                item.done ? "bg-emerald-600 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-300",
              ].join(" ")}
              aria-hidden
            >
              {item.done ? "✓" : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium leading-snug text-zinc-900">
                {itemLabel(item, readiness, dict)}
              </p>
              <div className="mt-1.5">
                {item.done ? (
                  <span className="text-[11px] font-medium text-emerald-700">{dict.complete}</span>
                ) : (
                  <Link href={item.href} className="text-[11px] font-medium text-sky-800 underline-offset-2 hover:underline">
                    {dict.setUp}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
