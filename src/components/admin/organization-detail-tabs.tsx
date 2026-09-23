"use client";

import type { ReactNode } from "react";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";

type TabKey = "overview" | "billing" | "activity" | "users" | "contacts";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "billing", label: "Billing" },
  { key: "activity", label: "Activity" },
  { key: "users", label: "Users" },
  { key: "contacts", label: "Contacts" },
];

function parseTab(value: string | null): TabKey {
  return TABS.some((tab) => tab.key === value) ? (value as TabKey) : "overview";
}

type OrganizationDetailTabsProps = {
  overview: ReactNode;
  billing: ReactNode;
  activity: ReactNode;
  users: ReactNode;
  contacts: ReactNode;
};

export function OrganizationDetailTabs({
  overview,
  billing,
  activity,
  users,
  contacts,
}: OrganizationDetailTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const selectTab = useCallback(
    (next: TabKey) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const content: Record<TabKey, ReactNode> = {
    overview,
    billing,
    activity,
    users,
    contacts,
  };

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Client detail"
      >
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? primaryButtonClass : secondaryButtonClass}
            onClick={() => selectTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        aria-label={TABS.find((entry) => entry.key === tab)?.label}
        className="flex flex-col gap-6"
      >
        {content[tab]}
      </div>
    </div>
  );
}
