"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AutomationCard } from "@/components/automation/automation-card";
import { AutomationDrawer } from "@/components/automation/automation-drawer";
import { ManualQuickSend } from "@/components/automation/manual-quick-send";
import {
  buildAutomationCards,
  toPayloadRule,
  withAllChannelsCleared,
  withAllChannelsToggled,
  type RulePayload,
} from "@/components/automation/rule-utils";
import type { AutomationCardData, AutomationStatus, OrgCategory } from "@/components/automation/types";
import { useOccasions } from "@/components/occasions/use-occasions";
import { InlineAlert } from "@/components/ui/feedback";
import { fetchOrganizationCategories } from "@/lib/client/organization-reference-data";
import { PageHeader, Panel, inputClass, primaryButtonClass } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import type { CategoryAutomationSettingsView } from "@/lib/automation/category-settings";

type SettingsByOccasion = Partial<Record<string, CategoryAutomationSettingsView>>;

const tabButtonBase =
  "rounded-full px-4 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

const AUTOMATION_STATUS_ORDER: Record<AutomationStatus, number> = {
  active: 0,
  paused: 1,
  disabled: 2,
};

export function SendMessagesPageClient() {
  const { showToast } = useToast();
  const { occasions } = useOccasions();

  const [tab, setTab] = useState<"scheduled" | "manual">("scheduled");
  const [categories, setCategories] = useState<OrgCategory[]>([]);
  const [settingsByOccasion, setSettingsByOccasion] = useState<SettingsByOccasion>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [occasionFilter, setOccasionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AutomationStatus>("all");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<AutomationCardData | null>(null);

  useEffect(() => {
    if (occasions.length === 0) {
      return;
    }

    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [categories, ...occasionResponses] = await Promise.all([
          fetchOrganizationCategories(),
          ...occasions.map((occasion) =>
            fetch(`/api/v1/settings/category-automation?occasionId=${occasion.id}`),
          ),
        ]);

        setCategories(categories);

        const nextSettings: SettingsByOccasion = {};
        for (let i = 0; i < occasions.length; i += 1) {
          const response = occasionResponses[i]!;
          const body = await response.json();
          if (response.ok) {
            nextSettings[occasions[i]!.id] = body.data as CategoryAutomationSettingsView;
          }
        }
        setSettingsByOccasion(nextSettings);
      } catch {
        setError("Could not load automations. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    }
    void loadAll();
  }, [occasions]);

  const refreshOccasion = useCallback(async (occasionId: string) => {
    try {
      const response = await fetch(`/api/v1/settings/category-automation?occasionId=${occasionId}`);
      const body = await response.json();
      if (response.ok) {
        setSettingsByOccasion((current) => ({
          ...current,
          [occasionId]: body.data as CategoryAutomationSettingsView,
        }));
      }
    } catch {
      // Next full load will recover; the action itself already reported success or failure.
    }
  }, []);

  const allCards = useMemo(() => {
    const cards: AutomationCardData[] = [];
    for (const occasion of occasions) {
      const settings = settingsByOccasion[occasion.id];
      if (settings) {
        cards.push(...buildAutomationCards(occasion.id, occasion.name, settings));
      }
    }
    return cards.sort((a, b) => {
      const byStatus = AUTOMATION_STATUS_ORDER[a.status] - AUTOMATION_STATUS_ORDER[b.status];
      return byStatus || a.title.localeCompare(b.title);
    });
  }, [occasions, settingsByOccasion]);

  const filteredCards = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allCards.filter((card) => {
      if (term && !card.title.toLowerCase().includes(term) && !card.categoryName.toLowerCase().includes(term)) {
        return false;
      }
      if (categoryFilter !== "all" && card.categoryId !== categoryFilter) {
        return false;
      }
      if (occasionFilter !== "all" && card.occasionId !== occasionFilter) {
        return false;
      }
      if (statusFilter !== "all" && card.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [allCards, search, categoryFilter, occasionFilter, statusFilter]);

  const hasFilters =
    Boolean(search.trim()) || categoryFilter !== "all" || occasionFilter !== "all" || statusFilter !== "all";

  async function putRules(occasionId: string, rules: RulePayload[]) {
    const response = await fetch("/api/v1/settings/category-automation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ occasionId, rules }),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error?.message ?? "Could not update automation.");
    }
    await refreshOccasion(occasionId);
  }

  async function handleToggle(card: AutomationCardData) {
    setBusyKey(card.key);
    try {
      const rules = settingsByOccasion[card.occasionId]?.rules ?? [];
      const isActive = card.status === "active";
      const nextRules = rules.map((rule) =>
        rule.categoryId !== card.categoryId
          ? toPayloadRule(rule)
          : withAllChannelsToggled(rule, !isActive),
      );
      await putRules(card.occasionId, nextRules);
      showToast(isActive ? "Automation paused." : "Automation resumed.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update automation.", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDelete(card: AutomationCardData) {
    if (!window.confirm(`Delete the ${card.title} automation?`)) {
      return;
    }
    setBusyKey(card.key);
    try {
      const rules = settingsByOccasion[card.occasionId]?.rules ?? [];
      const nextRules = rules.map((rule) =>
        rule.categoryId !== card.categoryId ? toPayloadRule(rule) : withAllChannelsCleared(rule),
      );
      await putRules(card.occasionId, nextRules);
      showToast("Automation deleted.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not delete automation.", "error");
    } finally {
      setBusyKey(null);
    }
  }

  function openCreateDrawer() {
    setEditingAutomation(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(card: AutomationCardData) {
    setEditingAutomation(card);
    setDrawerOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Send Messages"
        description="Create and manage automated birthday and anniversary greetings."
        actions={
          <button type="button" className={primaryButtonClass} onClick={openCreateDrawer}>
            + Create Automation
          </button>
        }
      />

      <div className="flex gap-2 border-b border-stone-200 pb-3">
        <button
          type="button"
          className={`${tabButtonBase} ${
            tab === "scheduled" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
          }`}
          onClick={() => setTab("scheduled")}
        >
          Scheduled
        </button>
        <button
          type="button"
          className={`${tabButtonBase} ${
            tab === "manual" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
          }`}
          onClick={() => setTab("manual")}
        >
          Send Now
        </button>
      </div>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      {tab === "scheduled" ? (
        <div className="flex flex-col gap-4">
          <Panel className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="block min-w-0 flex-1 text-sm">
                <span className="sr-only">Search automations</span>
                <input
                  className={inputClass}
                  placeholder="Search by name or category"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label className="block text-sm sm:w-44">
                <span className="sr-only">Category filter</span>
                <select
                  className={inputClass}
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="all">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm sm:w-44">
                <span className="sr-only">Occasion filter</span>
                <select
                  className={inputClass}
                  value={occasionFilter}
                  onChange={(event) => setOccasionFilter(event.target.value)}
                >
                  <option value="all">All occasions</option>
                  {occasions.map((occasion) => (
                    <option key={occasion.id} value={occasion.id}>
                      {occasion.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm sm:w-44">
                <span className="sr-only">Status filter</span>
                <select
                  className={inputClass}
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as "all" | AutomationStatus)
                  }
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
            </div>
          </Panel>

          {loading ? (
            <p className="p-6 text-sm text-stone-600">Loading automations…</p>
          ) : filteredCards.length === 0 ? (
            <Panel>
              <div className="flex flex-col items-start gap-4 px-5 py-10 sm:px-8">
                <div className="max-w-md">
                  <h2 className="text-base font-semibold text-stone-900">
                    {hasFilters ? "No matching automations" : "No automations created yet."}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                    {hasFilters
                      ? "Try a different search or clear the filters."
                      : "Create your first birthday or anniversary automation."}
                  </p>
                </div>
                {!hasFilters ? (
                  <button type="button" className={primaryButtonClass} onClick={openCreateDrawer}>
                    Create Automation
                  </button>
                ) : null}
              </div>
            </Panel>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filteredCards.map((card) => (
                <AutomationCard
                  key={card.key}
                  automation={card}
                  busy={busyKey === card.key}
                  onEdit={() => openEditDrawer(card)}
                  onToggle={() => void handleToggle(card)}
                  onDelete={() => void handleDelete(card)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <ManualQuickSend />
      )}

      <AutomationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        automation={editingAutomation}
        categories={categories}
        settingsByOccasion={settingsByOccasion}
        onSaved={async (occasionId) => {
          await refreshOccasion(occasionId);
          showToast(editingAutomation ? "Automation updated." : "Automation created.");
        }}
      />
    </div>
  );
}
