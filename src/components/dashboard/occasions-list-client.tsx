"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { OccasionType } from "../../lib/automation/occasion-types";

import { InlineAlert, StatusBadge } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  compactSecondaryButtonClass,
  inputClass,
} from "@/components/ui/page";
import type { OccasionsDayView } from "@/lib/queue/occasions-day-view";
import {
  overallHumanStatus,
  type OccasionHumanStatus,
} from "@/lib/queue/occasions-status";
import { getOccasionStatusLabel } from "@/lib/ui/customer-labels";
import { formatDisplayDate, formatScheduledSendDetail } from "@/lib/ui/datetime";
import { getOccasionsDict } from "@/lib/i18n/dictionaries/occasions";
import { useLocale } from "@/lib/i18n/use-locale";

const PAGE_SIZE = 50;

function matchesOccasionType(occasionName: string, type: OccasionType) {
  const normalizedName = occasionName.trim().toLowerCase();
  if (type === "BIRTHDAY") return normalizedName === "birthday";
  if (type === "ANNIVERSARY") return normalizedName === "anniversary";
  return normalizedName !== "birthday" && normalizedName !== "anniversary";
}

export type OccasionsListClientProps = {
  initialView: OccasionsDayView;
  categories: Array<{ id: string; name: string }>;
  initialType: OccasionType;
  initialCategoryId: string;
  todayDate: string;
};

function statusTone(
  status: OccasionHumanStatus,
): "neutral" | "success" | "warning" | "danger" | "info" | "scheduled" {
  if (status === "sent") return "success";
  if (status === "failed") return "danger";
  if (status === "pending" || status === "skipped") return "warning";
  if (status === "sending") return "info";
  if (status === "will_send") return "scheduled";
  return "neutral";
}

function buildOccasionsHref(params: {
  type: OccasionType;
  date: string;
  categoryId: string;
  todayDate: string;
}) {
  const search = new URLSearchParams({ type: params.type });
  if (params.date !== params.todayDate) {
    search.set("date", params.date);
  }
  if (params.categoryId !== "all") {
    search.set("categoryId", params.categoryId);
  }
  return `/dashboard/occasions?${search.toString()}`;
}

export function OccasionsListClient({
  initialView,
  categories,
  initialType,
  initialCategoryId,
  todayDate,
}: OccasionsListClientProps) {
  const dict = getOccasionsDict(useLocale()).list;
  const OCCASION_TYPES: Array<{ value: OccasionType; label: string }> = [
    { value: "BIRTHDAY", label: dict.typeBirthday },
    { value: "ANNIVERSARY", label: dict.typeAnniversary },
    { value: "CUSTOM", label: dict.typeCustom },
  ];
  const router = useRouter();
  const [date, setDate] = useState(initialView.targetDate);
  const [type, setType] = useState<OccasionType>(initialType);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [view, setView] = useState(initialView);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(1);
  const skipInitialFetch = useRef(true);

  useEffect(() => {
    const href = buildOccasionsHref({ type, date, categoryId, todayDate });
    router.replace(href, { scroll: false });
  }, [categoryId, date, router, todayDate, type]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ date });
        if (categoryId !== "all") {
          params.set("categoryId", categoryId);
        }
        const response = await fetch(`/api/v1/occasions/day?${params}`);
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error?.message ?? dict.couldNotLoadGreetings);
        }
        if (!cancelled) {
          setView(body.data as OccasionsDayView);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error && loadError.message
              ? loadError.message
              : dict.couldNotLoadGreetingsGeneric,
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, date, refresh]);

  const section = useMemo(() => {
    return (
      view.sections.find((item) => matchesOccasionType(item.occasionName, type)) ?? {
        occasionId: `${type.toLowerCase()}-empty`,
        occasionName:
          OCCASION_TYPES.find((item) => item.value === type)?.label ?? dict.occasionsFallback,
        label: OCCASION_TYPES.find((item) => item.value === type)?.label ?? dict.occasionsFallback,
        count: 0,
        automationEnabled: false,
        whatsappAutomationEnabled: false,
        emailAutomationEnabled: false,
        sendTimeLabel: dict.notConfigured,
        contacts: [],
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, view.sections]);

  const selectedCategoryName = useMemo(() => {
    if (categoryId === "all") {
      return dict.allGroups;
    }
    return (
      categories.find((category) => category.id === categoryId)?.name ?? dict.groupFallback
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, categoryId]);

  const totalPages = Math.max(1, Math.ceil(section.contacts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageContacts = section.contacts.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const dateLabel = date === todayDate ? dict.today : formatDisplayDate(date);

  return (
    <PageShell>
      <PageHeader
        title={section.label}
        description={dict.peopleWith(section.label, dateLabel)}
        actions={
          <Link href="/dashboard" className={compactSecondaryButtonClass}>
            {dict.backToToday}
          </Link>
        }
      />

      <Panel className="flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm sm:w-56">
          <span className="font-medium text-stone-800">{dict.occasionsFallback}</span>
          <select
            className={`${inputClass} mt-1`}
            value={type}
            onChange={(event) => {
              setType(event.target.value as OccasionType);
              setPage(1);
            }}
          >
            {OCCASION_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:w-56">
          <span className="font-medium text-stone-800">{dict.group}</span>
          <select
            className={`${inputClass} mt-1`}
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">{dict.allGroups}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-stone-800">{dict.date}</span>
          <input
            type="date"
            className={`${inputClass} mt-1`}
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <button
          type="button"
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium"
          onClick={() => setRefresh((value) => value + 1)}
        >
          {dict.refresh}
        </button>
        <p className="text-sm text-stone-600">
          {dict.sendAfter(section.sendTimeLabel)}
        </p>
      </Panel>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {loading ? <Panel className="p-5">{dict.loadingGreetings}</Panel> : null}

      {!loading ? (
        <Panel className="space-y-3 p-4">
          <div>
            <h2 className="font-semibold text-stone-900">
              {section.label}
              {section.count > 0 ? ` · ${section.count}` : ""}
              {categoryId !== "all" ? ` · ${selectedCategoryName}` : ""}
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              {section.automationEnabled || section.whatsappAutomationEnabled
                ? formatScheduledSendDetail(date, section.sendTimeLabel)
                : dict.automaticSendingOff}
            </p>
          </div>

          {section.contacts.length === 0 ? (
            <p className="py-3 text-sm text-stone-600">
              {dict.noItemsForDate(section.label)}
              {categoryId !== "all" ? dict.inGroup(selectedCategoryName) : ""}.
            </p>
          ) : (
            <>
              <div className="divide-y divide-stone-100">
                {pageContacts.map((contact) => {
                  const status = overallHumanStatus(
                    contact.smsAutomationEnabled,
                    contact.deliveryStatus,
                    contact.whatsappAutomationEnabled,
                    contact.whatsappDeliveryStatus,
                  );
                  return (
                    <div
                      key={contact.id}
                      className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div>
                        <span className="font-medium text-stone-900">
                          {contact.name}
                        </span>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {contact.categoryName ?? dict.noGroup} ·{" "}
                          {contact.mobile}
                        </p>
                        {contact.whatsappMessagePreview ??
                        contact.messagePreview ? (
                          <p className="mt-2 text-sm text-stone-700">
                            {contact.whatsappMessagePreview ??
                              contact.messagePreview}
                          </p>
                        ) : null}
                      </div>
                      {status !== "not_set_up" ? (
                        <StatusBadge
                          label={getOccasionStatusLabel(status)}
                          tone={statusTone(status)}
                          detail={
                            status === "will_send"
                              ? formatScheduledSendDetail(
                                  date,
                                  contact.sendTimeLabel,
                                )
                              : undefined
                          }
                        />
                      ) : (
                        <StatusBadge label={dict.notSetUp} tone="neutral" />
                      )}
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3">
                  <p className="text-sm text-stone-600">
                    {dict.pageOf(safePage, totalPages, section.count)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={compactSecondaryButtonClass}
                      disabled={safePage <= 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                      {dict.previous}
                    </button>
                    <button
                      type="button"
                      className={compactSecondaryButtonClass}
                      disabled={safePage >= totalPages}
                      onClick={() =>
                        setPage((value) => Math.min(totalPages, value + 1))
                      }
                    >
                      {dict.next}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </Panel>
      ) : null}
    </PageShell>
  );
}
