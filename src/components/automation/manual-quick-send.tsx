"use client";

import { useEffect, useMemo, useState } from "react";
import type { Channel } from "@prisma/client";

import { useOccasions } from "@/components/occasions/use-occasions";
import { InlineAlert } from "@/components/ui/feedback";
import { fetchOrganizationCategories } from "@/lib/client/organization-reference-data";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { normalizeMobile } from "@/lib/contacts/mobile";
import { chunkIds, MANUAL_SEND_API_BATCH_SIZE } from "@/lib/queue/manual-send-batches";

import { CategoryMultiSelect } from "./category-multi-select";
import { CHANNEL_LABEL, type OrgCategory } from "./types";

type ContactOption = {
  id: string;
  name: string;
  mobile: string;
};

type TemplateOption = {
  id: string;
  name: string;
};

type QuickListRecipient = {
  name: string;
  mobile: string;
};

type InvalidQuickListEntry = {
  line: string;
  reason: string;
};

type ParsedQuickList = {
  valid: QuickListRecipient[];
  invalid: InvalidQuickListEntry[];
  duplicates: QuickListRecipient[];
};

type ChannelFormState = { enabled: boolean; templateId: string };

type CategoryAudienceSummary = {
  categoryCounts: Record<string, number>;
  contactIds: string[];
};

const CHANNELS: Channel[] = ["WHATSAPP", "EMAIL", "SMS"];
const SEARCH_DEBOUNCE_MS = 250;
const FORM_SECTION_CLASS = "rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm sm:p-5";
const QUICK_LIST_PLACEHOLDER = `Paste recipients here...

Name, Phone Number
Name Phone Number
Phone Number

Supports:
- Name + Number
- Number only
- Excel/Google Sheets paste`;

function emptyChannelForm(): Record<Channel, ChannelFormState> {
  return {
    WHATSAPP: { enabled: false, templateId: "" },
    EMAIL: { enabled: false, templateId: "" },
    SMS: { enabled: false, templateId: "" },
  };
}

async function collectCategoryContactIds(categoryIds: string[]): Promise<CategoryAudienceSummary> {
  const contactIds = new Set<string>();
  const categoryCounts: Record<string, number> = {};

  for (const selectedCategoryId of categoryIds) {
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const params = new URLSearchParams({
        categoryId: selectedCategoryId,
        isActive: "true",
        page: String(page),
        limit: "100",
      });
      const response = await fetch(`/api/v1/contacts?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Could not load recipients.");
      }
      categoryCounts[selectedCategoryId] = body.meta?.total ?? 0;
      for (const contact of body.data as Array<{ id: string }>) {
        contactIds.add(contact.id);
      }
      totalPages = body.meta?.totalPages ?? 1;
      page += 1;
    }
  }

  return { categoryCounts, contactIds: Array.from(contactIds) };
}

function parseQuickListInput(input: string): ParsedQuickList {
  const valid: QuickListRecipient[] = [];
  const invalid: InvalidQuickListEntry[] = [];
  const duplicates: QuickListRecipient[] = [];
  const seenMobiles = new Set<string>();

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const columns = line.split(/\t|,/).map((part) => part.trim()).filter(Boolean);
    const mobileText = columns.length >= 2 ? columns[columns.length - 1]! : line.match(/(?:\+?91[\s()-]*)?(?:0[\s()-]*)?[6-9](?:[\s()-]*\d){9}\s*$/)?.[0];
    const nameText =
      columns.length >= 2
        ? columns.slice(0, -1).join(" ").trim()
        : mobileText
          ? line.slice(0, line.length - mobileText.length).trim()
          : "";

    if (!mobileText) {
      invalid.push({ line, reason: "Invalid phone number" });
      continue;
    }

    try {
      const mobile = normalizeMobile(mobileText);
      const name = nameText || "Unnamed Recipient";
      if (seenMobiles.has(mobile)) {
        duplicates.push({ name, mobile });
        continue;
      }
      seenMobiles.add(mobile);
      valid.push({ name, mobile });
    } catch (error) {
      invalid.push({
        line,
        reason: error instanceof Error ? error.message : "Invalid phone number",
      });
    }
  }

  return { valid, invalid, duplicates };
}

export function ManualQuickSend() {
  const { showToast } = useToast();
  const { occasions } = useOccasions();

  const [recipientMode, setRecipientMode] = useState<"category" | "individual" | "quickList">("category");

  const [categories, setCategories] = useState<OrgCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<OrgCategory[]>([]);
  const [categoryAudienceSummary, setCategoryAudienceSummary] = useState<CategoryAudienceSummary>({
    categoryCounts: {},
    contactIds: [],
  });
  const [loadingCategoryAudience, setLoadingCategoryAudience] = useState(false);

  const [recipientQuery, setRecipientQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recipientOptions, setRecipientOptions] = useState<ContactOption[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<ContactOption[]>([]);
  const [quickListInput, setQuickListInput] = useState("");
  const [debouncedQuickListInput, setDebouncedQuickListInput] = useState("");

  const [occasionId, setOccasionId] = useState("");
  const [channelForm, setChannelForm] = useState<Record<Channel, ChannelFormState>>(emptyChannelForm());
  const [templatesByChannel, setTemplatesByChannel] = useState<Record<Channel, TemplateOption[]>>({
    WHATSAPP: [],
    EMAIL: [],
    SMS: [],
  });

  const [previews, setPreviews] = useState<Partial<Record<Channel, string>>>({});
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendSummary, setSendSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCategories() {
      try {
        setCategories(await fetchOrganizationCategories());
      } catch {
        // Category selection just stays empty.
      }
    }
    void loadCategories();
  }, []);

  useEffect(() => {
    function selectDefaultOccasion() {
      setOccasionId((current) => {
        if (current && occasions.some((occasion) => occasion.id === current)) {
          return current;
        }
        return occasions[0]?.id ?? "";
      });
    }
    if (occasions.length > 0) {
      selectDefaultOccasion();
    }
  }, [occasions]);

  useEffect(() => {
    let cancelled = false;
    async function loadCategoryAudience() {
      if (recipientMode !== "category" || selectedCategories.length === 0) {
        setCategoryAudienceSummary({ categoryCounts: {}, contactIds: [] });
        setLoadingCategoryAudience(false);
        return;
      }
      setLoadingCategoryAudience(true);
      try {
        const summary = await collectCategoryContactIds(selectedCategories.map((category) => category.id));
        if (!cancelled) {
          setCategoryAudienceSummary(summary);
        }
      } catch {
        if (!cancelled) {
          setCategoryAudienceSummary({ categoryCounts: {}, contactIds: [] });
        }
      } finally {
        if (!cancelled) setLoadingCategoryAudience(false);
      }
    }
    void loadCategoryAudience();
    return () => {
      cancelled = true;
    };
  }, [recipientMode, selectedCategories]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(recipientQuery), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [recipientQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuickListInput(quickListInput), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [quickListInput]);

  useEffect(() => {
    let cancelled = false;
    async function search() {
      if (debouncedQuery.trim().length < 2) {
        setRecipientOptions([]);
        return;
      }
      try {
        const params = new URLSearchParams({ search: debouncedQuery.trim(), limit: "8", isActive: "true" });
        const response = await fetch(`/api/v1/contacts?${params.toString()}`);
        const body = await response.json();
        if (!cancelled && response.ok) {
          setRecipientOptions(body.data as ContactOption[]);
        }
      } catch {
        // Search is best-effort; leave the previous options in place.
      }
    }
    void search();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    let cancelled = false;
    async function loadTemplates() {
      if (!occasionId) {
        return;
      }
      setPreviews({});
      try {
        const results = await Promise.all(
          CHANNELS.map((channel) =>
            fetch(
              `/api/v1/templates?isActive=true&channel=${channel}&occasionId=${occasionId}&limit=100`,
            ).then((response) => response.json().then((body) => ({ channel, response, body }))),
          ),
        );
        if (cancelled) return;
        const next = { WHATSAPP: [], EMAIL: [], SMS: [] } as Record<Channel, TemplateOption[]>;
        for (const { channel, response, body } of results) {
          if (response.ok) {
            next[channel] = (body.data as Array<{ id: string; name: string }>).map((t) => ({
              id: t.id,
              name: t.name,
            }));
          }
        }
        setTemplatesByChannel(next);
      } catch {
        // Leave templates empty; the selects will show none available.
      }
    }
    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [occasionId]);

  function toggleChannel(channel: Channel, enabled: boolean) {
    setChannelForm((current) => ({
      ...current,
      [channel]: { enabled, templateId: enabled ? current[channel].templateId : "" },
    }));
    setPreviews((current) => ({ ...current, [channel]: undefined }));
  }

  function setChannelTemplate(channel: Channel, templateId: string) {
    setChannelForm((current) => ({ ...current, [channel]: { ...current[channel], templateId } }));
    setPreviews((current) => ({ ...current, [channel]: undefined }));
  }

  function toggleRecipientSelection(contact: ContactOption) {
    setSelectedRecipients((current) =>
      current.some((recipient) => recipient.id === contact.id)
        ? current.filter((recipient) => recipient.id !== contact.id)
        : [...current, contact],
    );
    setPreviews({});
  }

  function removeRecipient(contactId: string) {
    setSelectedRecipients((current) => current.filter((recipient) => recipient.id !== contactId));
    setPreviews({});
  }

  const selectedChannels = CHANNELS.filter((c) => channelForm[c].enabled);
  const selectedCategoryCount = selectedCategories.length;
  const selectedRecipientIds = useMemo(
    () => new Set(selectedRecipients.map((recipient) => recipient.id)),
    [selectedRecipients],
  );
  const selectedRecipientCount = selectedRecipients.length;
  const parsedQuickList = useMemo(
    () => parseQuickListInput(debouncedQuickListInput),
    [debouncedQuickListInput],
  );
  const quickListRecipientCount = parsedQuickList.valid.length;
  const recipientReady =
    recipientMode === "category"
      ? selectedCategoryCount > 0
      : recipientMode === "individual"
        ? selectedRecipientCount > 0
        : quickListRecipientCount > 0;
  const channelsReady =
    selectedChannels.length > 0 && selectedChannels.every((c) => Boolean(channelForm[c].templateId));
  const canAct = recipientReady && channelsReady;
  const actionControlsDisabled =
    !channelsReady || (recipientMode === "category" && loadingCategoryAudience);

  async function handlePreview() {
    if (recipientMode === "category" && selectedCategoryCount === 0) {
      setError("Please select at least one category.");
      return;
    }
    if (recipientMode === "individual" && selectedRecipientCount === 0) {
      setError("Please select at least one contact.");
      return;
    }
    if (recipientMode === "quickList" && quickListRecipientCount === 0) {
      setError("Please enter at least one valid recipient.");
      return;
    }
    if (!canAct) return;
    setPreviewing(true);
    setError(null);
    try {
      const sampleContactIds = recipientMode === "individual" ? [selectedRecipients[0]!.id] : [];
      const sampleRecipients = recipientMode === "quickList" ? [parsedQuickList.valid[0]!] : [];
      const results = await Promise.all(
        selectedChannels.map((channel) =>
          fetch("/api/v1/manual-send/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              templateId: channelForm[channel].templateId,
              contactIds: sampleContactIds,
              recipients: sampleRecipients,
            }),
          }).then((response) => response.json().then((body) => ({ channel, response, body }))),
        ),
      );
      const next: Partial<Record<Channel, string>> = {};
      for (const { channel, response, body } of results) {
        if (response.ok) {
          next[channel] = body.data?.previews?.[0]?.renderedPreview ?? "";
        }
      }
      setPreviews(next);
    } catch {
      setError("Could not load a preview. Check your connection and try again.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSend() {
    if (recipientMode === "category" && selectedCategoryCount === 0) {
      setError("Please select at least one category.");
      return;
    }
    if (recipientMode === "individual" && selectedRecipientCount === 0) {
      setError("Please select at least one contact.");
      return;
    }
    if (recipientMode === "quickList" && quickListRecipientCount === 0) {
      setError("Please enter at least one valid recipient.");
      return;
    }
    if (!canAct) return;
    setSending(true);
    setError(null);
    setSendSummary(null);

    try {
      const contactIds =
        recipientMode === "individual"
          ? selectedRecipients.map((recipient) => recipient.id)
          : recipientMode === "category"
            ? categoryAudienceSummary.contactIds
            : [];
      const quickRecipients = recipientMode === "quickList" ? parsedQuickList.valid : [];
      const recipientCount = contactIds.length + quickRecipients.length;
      if (recipientCount === 0) {
        setError("No matching contacts to send to.");
        return;
      }

      const clientOperationId = crypto.randomUUID();
      const perChannelCreated: Partial<Record<Channel, number>> = {};

      for (const channel of selectedChannels) {
        const templateId = channelForm[channel].templateId;
        const batches =
          recipientMode === "quickList"
            ? chunkIds(quickRecipients, MANUAL_SEND_API_BATCH_SIZE)
            : chunkIds(contactIds, MANUAL_SEND_API_BATCH_SIZE);
        let created = 0;
        for (const batch of batches) {
          const response = await fetch("/api/v1/manual-send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              templateId,
              contactIds: recipientMode === "quickList" ? [] : batch,
              recipients: recipientMode === "quickList" ? batch : [],
              clientOperationId,
            }),
          });
          const body = await response.json();
          if (!response.ok) {
            throw new Error(
              body.error?.message ?? `Could not send ${CHANNEL_LABEL[channel]} messages.`,
            );
          }
          created += body.data?.creation?.created ?? 0;
        }
        perChannelCreated[channel] = created;
      }

      const summary = selectedChannels
        .map((channel) => `${perChannelCreated[channel] ?? 0} via ${CHANNEL_LABEL[channel]}`)
        .join(", ");
      setSendSummary(`Sent to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"}: ${summary}.`);
      showToast("Messages sent.");
      setPreviews({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send these messages.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Send Now</h2>
        <p className="mt-1 text-sm text-stone-500">
          Send a one-time greeting now, no scheduling involved.
        </p>
      </div>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {sendSummary ? <InlineAlert tone="success">{sendSummary}</InlineAlert> : null}

      <section className={FORM_SECTION_CLASS}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-stone-800">Recipients</span>
          <div className="flex gap-4 text-sm text-stone-700">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="recipient-mode"
              checked={recipientMode === "category"}
              onChange={() => setRecipientMode("category")}
            />
            Categories
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="recipient-mode"
              checked={recipientMode === "individual"}
              onChange={() => setRecipientMode("individual")}
            />
            Saved Contacts
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="recipient-mode"
              checked={recipientMode === "quickList"}
              onChange={() => setRecipientMode("quickList")}
            />
            Quick List
          </label>
          </div>
        </div>

        {recipientMode === "category" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-w-0 flex-col gap-3">
            <CategoryMultiSelect
              categories={categories}
              selectedCategories={selectedCategories}
              onChange={(nextCategories) => {
                setSelectedCategories(nextCategories);
                setPreviews({});
              }}
            />

            <p className="text-xs leading-relaxed text-stone-500">
              {selectedCategoryCount === 0
                ? "No categories selected"
                : (
                  <>
                    {selectedCategoryCount} Categor{selectedCategoryCount === 1 ? "y" : "ies"} Selected
                    <br />
                    {loadingCategoryAudience
                      ? "Counting unique recipients..."
                      : `${categoryAudienceSummary.contactIds.length} Unique Recipient${
                          categoryAudienceSummary.contactIds.length === 1 ? "" : "s"
                        }`}
                  </>
                )}
            </p>
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-700">
            {selectedCategoryCount === 0 ? (
              "No categories selected"
            ) : loadingCategoryAudience ? (
              "Counting recipients..."
            ) : (
              <>
                <span className="font-medium text-stone-900">Categories Selected</span>
                <div className="mt-2 flex flex-col gap-1 text-xs text-stone-600">
                  {selectedCategories.map((category) => {
                    const count = categoryAudienceSummary.categoryCounts[category.id] ?? 0;

                    return (
                      <div key={category.id} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate">{category.name}</span>
                        <span className="shrink-0">
                          {count} Contact{count === 1 ? "" : "s"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 border-t border-stone-200 pt-2">
                  <span className="font-medium text-stone-900">Total Unique Recipients</span>
                  <br />
                  {categoryAudienceSummary.contactIds.length} Contact
                  {categoryAudienceSummary.contactIds.length === 1 ? "" : "s"}
                </div>
              </>
            )}
          </div>
          </div>
        ) : recipientMode === "individual" ? (
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-xs font-medium text-stone-700">Selected Contacts</span>
              {selectedRecipients.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedRecipients.map((recipient) => (
                    <span
                      key={recipient.id}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-800"
                    >
                      <span className="truncate">{recipient.name}</span>
                      <button
                        type="button"
                        className="rounded-full px-1 text-stone-500 outline-none hover:bg-stone-200 hover:text-stone-800 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                        onClick={() => removeRecipient(recipient.id)}
                        aria-label={`Remove ${recipient.name}`}
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-stone-500">No contacts selected</p>
              )}
            </div>

            <div className="relative">
              <input
                className={inputClass}
                placeholder="Search contacts..."
                value={recipientQuery}
                onChange={(event) => setRecipientQuery(event.target.value)}
              />
              {recipientOptions.length > 0 ? (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
                  {recipientOptions.map((option) => {
                    const selected = selectedRecipientIds.has(option.id);

                    return (
                      <li key={option.id}>
                        <label
                          className="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50"
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selected}
                            onChange={() => toggleRecipientSelection(option)}
                            aria-label={`Select ${option.name}`}
                          />
                          <span className="flex min-w-0 flex-col">
                            <span className="font-medium text-stone-900">{option.name}</span>
                            <span className="text-xs text-stone-500">{option.mobile}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <p className="text-xs text-stone-500">
              {selectedRecipientCount === 0
                ? "No contacts selected"
                : `${selectedRecipientCount} Contact${selectedRecipientCount === 1 ? "" : "s"} Selected`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <label className="block text-sm">
              <span className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-stone-700">Quick List</span>
                {quickListInput ? (
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => {
                      setQuickListInput("");
                      setDebouncedQuickListInput("");
                      setPreviews({});
                    }}
                  >
                    Clear List
                  </button>
                ) : null}
              </span>
              <textarea
                className={`${inputClass} mt-2 min-h-56 resize-y`}
                placeholder={QUICK_LIST_PLACEHOLDER}
                value={quickListInput}
                onChange={(event) => setQuickListInput(event.target.value)}
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <div className="text-xs font-medium text-stone-700">Recipients</div>
                {parsedQuickList.valid.length > 0 ? (
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-stone-200 bg-white">
                    {parsedQuickList.valid.slice(0, 100).map((recipient, index) => (
                      <div
                        key={`${recipient.mobile}-${index}`}
                        className="border-b border-stone-100 px-3 py-2 last:border-0"
                      >
                        <div className="text-sm font-medium text-stone-900">
                          {recipient.name}
                        </div>
                        <div className="text-xs text-stone-500">{recipient.mobile}</div>
                      </div>
                    ))}
                    {parsedQuickList.valid.length > 100 ? (
                      <div className="px-3 py-2 text-xs text-stone-500">
                        +{parsedQuickList.valid.length - 100} more valid recipients
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-stone-500">No valid recipients yet</p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-700">
                  <span className="font-medium text-stone-900">
                    Recipients Ready: {quickListRecipientCount}
                  </span>
                  <br />
                  Invalid Entries: {parsedQuickList.invalid.length}
                  {parsedQuickList.duplicates.length > 0 ? (
                    <>
                      <br />
                      Duplicate Entries Ignored: {parsedQuickList.duplicates.length}
                    </>
                  ) : null}
                </div>

                {parsedQuickList.invalid.length > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <div className="text-xs font-medium text-amber-950">Invalid Entries</div>
                    <div className="mt-2 flex max-h-44 flex-col gap-2 overflow-y-auto">
                      {parsedQuickList.invalid.slice(0, 25).map((entry, index) => (
                        <div key={`${entry.line}-${index}`} className="text-xs text-amber-950">
                          <div className="font-medium">{entry.line}</div>
                          <div>{entry.reason}</div>
                        </div>
                      ))}
                      {parsedQuickList.invalid.length > 25 ? (
                        <div className="text-xs text-amber-900">
                          +{parsedQuickList.invalid.length - 25} more invalid entries
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <section className={FORM_SECTION_CLASS}>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Occasion</span>
          <select
            className={`${inputClass} mt-2`}
            value={occasionId}
            onChange={(event) => setOccasionId(event.target.value)}
          >
            {occasions.map((occasion) => (
              <option key={occasion.id} value={occasion.id}>
                {occasion.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className={FORM_SECTION_CLASS}>
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-stone-800">Delivery Channels</span>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        {CHANNELS.map((channel) => {
          const state = channelForm[channel];

          return (
            <label
              key={channel}
              className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-800"
            >
                <input
                  type="checkbox"
                  checked={state.enabled}
                  onChange={(event) => toggleChannel(channel, event.target.checked)}
                />
                {CHANNEL_LABEL[channel]}
              </label>
          );
        })}
        </div>
      </div>
      </section>
      </div>

      <section className={FORM_SECTION_CLASS}>
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-stone-800">Templates</span>
          {selectedChannels.length === 0 ? (
            <p className="text-sm text-stone-500">Choose at least one delivery channel.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {selectedChannels.map((channel) => {
                const state = channelForm[channel];
                const templates = templatesByChannel[channel];
                const preview = previews[channel];

                return (
                  <div key={channel} className="rounded-lg border border-stone-200 p-3">
                    <label className="block text-sm">
                      <span className="text-xs font-medium text-stone-700">
                        {CHANNEL_LABEL[channel]} Template
                      </span>
                      <select
                        className={`${inputClass} mt-1`}
                        value={state.templateId}
                        onChange={(event) => setChannelTemplate(channel, event.target.value)}
                      >
                        <option value="">Choose a template</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                      {templates.length === 0 ? (
                        <span className="mt-1 block text-xs text-stone-500">
                          No approved {CHANNEL_LABEL[channel]} templates yet.
                        </span>
                      ) : null}
                    </label>

                    {preview ? (
                      <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                        <p className="whitespace-pre-wrap text-sm text-stone-700">{preview}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => void handlePreview()}
          disabled={actionControlsDisabled || previewing}
        >
          {previewing ? "Loading preview..." : "Preview"}
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => void handleSend()}
          disabled={actionControlsDisabled || sending}
        >
          {sending ? "Sending..." : "Send Now"}
        </button>
      </div>
    </div>
  );
}
