"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Channel } from "@prisma/client";

import { useOccasions } from "@/components/occasions/use-occasions";
import { InlineAlert } from "@/components/ui/feedback";
import { fetchOrganizationCategories } from "@/lib/client/organization-reference-data";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { normalizeMobile } from "@/lib/contacts/mobile";
import {
  getGreetingRoutesDict,
  type GreetingRoutesDict,
} from "@/lib/i18n/dictionaries/greeting-routes";
import { useLocale } from "@/lib/i18n/use-locale";
import { chunkIds, MANUAL_SEND_API_BATCH_SIZE } from "@/lib/queue/manual-send-batches";
import { isValidQuickListEmail } from "@/lib/validation/manual-send";

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
  /** Blank when the line only carried an email address. */
  mobile: string;
  email?: string;
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
  /** First few contacts of each category, shown as a preview of who is in it. */
  categoryPreviews: Record<string, ContactOption[]>;
  contactIds: string[];
};

const CHANNELS: Channel[] = ["WHATSAPP", "EMAIL", "SMS"];
const SEARCH_DEBOUNCE_MS = 250;
const CONTACT_PICKER_PAGE_SIZE = 5;
const CATEGORY_PREVIEW_SIZE = 4;
const FORM_SECTION_CLASS = "rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm sm:p-5";

function emptyChannelForm(): Record<Channel, ChannelFormState> {
  return {
    WHATSAPP: { enabled: false, templateId: "" },
    EMAIL: { enabled: false, templateId: "" },
    SMS: { enabled: false, templateId: "" },
  };
}

async function collectCategoryContactIds(
  categoryIds: string[],
  dict: GreetingRoutesDict["manualQuickSend"],
): Promise<CategoryAudienceSummary> {
  const contactIds = new Set<string>();
  const categoryCounts: Record<string, number> = {};
  const categoryPreviews: Record<string, ContactOption[]> = {};

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
        throw new Error(body.error?.message ?? dict.failedToLoadRecipients);
      }
      categoryCounts[selectedCategoryId] = body.meta?.total ?? 0;
      const contacts = body.data as ContactOption[];
      if (page === 1) {
        categoryPreviews[selectedCategoryId] = contacts
          .slice(0, CATEGORY_PREVIEW_SIZE)
          .map(({ id, name, mobile }) => ({ id, name, mobile }));
      }
      for (const contact of contacts) {
        contactIds.add(contact.id);
      }
      totalPages = body.meta?.totalPages ?? 1;
      page += 1;
    }
  }

  return { categoryCounts, categoryPreviews, contactIds: Array.from(contactIds) };
}

function parseQuickListInput(
  input: string,
  dict: GreetingRoutesDict["manualQuickSend"],
): ParsedQuickList {
  const valid: QuickListRecipient[] = [];
  const invalid: InvalidQuickListEntry[] = [];
  const duplicates: QuickListRecipient[] = [];
  const seenRecipients = new Set<string>();

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // An email can sit anywhere on the line; pull it out first and parse
    // what is left as the usual name + phone number.
    const emailText = line.match(/[^\s,;<>()"']*@[^\s,;<>()"']*/)?.[0];
    if (emailText && !isValidQuickListEmail(emailText)) {
      invalid.push({ line, reason: dict.invalidEmailAddress });
      continue;
    }
    const rest = emailText ? line.replace(emailText, " ").replace(/[<>;]/g, " ").trim() : line;

    const columns = rest.split(/\t|,/).map((part) => part.trim()).filter(Boolean);
    // With an email present the last column may just be more of the name.
    const lastColumnIsMobile =
      columns.length >= 2 && (!emailText || /\d/.test(columns[columns.length - 1]!));
    const mobileText = lastColumnIsMobile
      ? columns[columns.length - 1]!
      : columns.join(" ").match(/(?:\+?91[\s()-]*)?(?:0[\s()-]*)?[6-9](?:[\s()-]*\d){9}\s*$/)?.[0];
    const nameText = lastColumnIsMobile
      ? columns.slice(0, -1).join(" ").trim()
      : mobileText
        ? columns.join(" ").slice(0, -mobileText.length).trim()
        : emailText
          ? columns.join(" ")
          : "";

    if (!mobileText && !emailText) {
      invalid.push({ line, reason: dict.invalidPhoneNumber });
      continue;
    }

    try {
      const mobile = mobileText ? normalizeMobile(mobileText) : "";
      const name = nameText || dict.unnamedRecipient;
      const recipient: QuickListRecipient = emailText
        ? { name, mobile, email: emailText }
        : { name, mobile };
      const identity = mobile || emailText!.toLowerCase();
      if (seenRecipients.has(identity)) {
        duplicates.push(recipient);
        continue;
      }
      seenRecipients.add(identity);
      valid.push(recipient);
    } catch (error) {
      invalid.push({
        line,
        reason: error instanceof Error ? error.message : dict.invalidPhoneNumber,
      });
    }
  }

  return { valid, invalid, duplicates };
}

export function ManualQuickSend() {
  const dict = getGreetingRoutesDict(useLocale()).manualQuickSend;
  const { showToast } = useToast();
  const { occasions } = useOccasions();

  const [recipientMode, setRecipientMode] = useState<"category" | "individual" | "quickList">("individual");

  const [categories, setCategories] = useState<OrgCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<OrgCategory[]>([]);
  const [categoryAudienceSummary, setCategoryAudienceSummary] = useState<CategoryAudienceSummary>({
    categoryCounts: {},
    categoryPreviews: {},
    contactIds: [],
  });
  const [loadingCategoryAudience, setLoadingCategoryAudience] = useState(false);

  const [recipientQuery, setRecipientQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recipientOptions, setRecipientOptions] = useState<ContactOption[]>([]);
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientTotalPages, setRecipientTotalPages] = useState(1);
  const [recipientsLoaded, setRecipientsLoaded] = useState(false);
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
        setCategoryAudienceSummary({ categoryCounts: {}, categoryPreviews: {}, contactIds: [] });
        setLoadingCategoryAudience(false);
        return;
      }
      setLoadingCategoryAudience(true);
      try {
        const summary = await collectCategoryContactIds(
          selectedCategories.map((category) => category.id),
          dict,
        );
        if (!cancelled) {
          setCategoryAudienceSummary(summary);
        }
      } catch {
        if (!cancelled) {
          setCategoryAudienceSummary({ categoryCounts: {}, categoryPreviews: {}, contactIds: [] });
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
    // Saved contacts are listed a page at a time as soon as this mode is
    // chosen; typing in the search box narrows the same list.
    async function loadContactPage() {
      if (recipientMode !== "individual") {
        return;
      }
      try {
        const params = new URLSearchParams({
          page: String(recipientPage),
          limit: String(CONTACT_PICKER_PAGE_SIZE),
          isActive: "true",
        });
        if (debouncedQuery.trim()) {
          params.set("search", debouncedQuery.trim());
        }
        const response = await fetch(`/api/v1/contacts?${params.toString()}`);
        const body = await response.json();
        if (!cancelled && response.ok) {
          setRecipientOptions(body.data as ContactOption[]);
          setRecipientTotalPages(Math.max(body.meta?.totalPages ?? 1, 1));
          setRecipientsLoaded(true);
        }
      } catch {
        // Listing is best-effort; leave the previous options in place.
      }
    }
    void loadContactPage();
    return () => {
      cancelled = true;
    };
  }, [recipientMode, debouncedQuery, recipientPage]);

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
    () => parseQuickListInput(debouncedQuickListInput, dict),
    [debouncedQuickListInput, dict],
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

  // Quick List lines may carry only a phone number or only an email, so check
  // every recipient can actually be reached on the chosen channels.
  function quickListChannelError(): string | null {
    if (recipientMode !== "quickList") return null;
    if (channelForm.EMAIL.enabled) {
      const missing = parsedQuickList.valid.filter((recipient) => !recipient.email).length;
      if (missing > 0) return dict.errorRecipientsMissingEmail(missing);
    }
    if (channelForm.WHATSAPP.enabled || channelForm.SMS.enabled) {
      const missing = parsedQuickList.valid.filter((recipient) => !recipient.mobile).length;
      if (missing > 0) return dict.errorRecipientsMissingMobile(missing);
    }
    return null;
  }

  async function handlePreview() {
    if (recipientMode === "category" && selectedCategoryCount === 0) {
      setError(dict.errorSelectCategory);
      return;
    }
    if (recipientMode === "individual" && selectedRecipientCount === 0) {
      setError(dict.errorSelectContact);
      return;
    }
    if (recipientMode === "quickList" && quickListRecipientCount === 0) {
      setError(dict.errorEnterRecipient);
      return;
    }
    if (!canAct) return;
    const channelError = quickListChannelError();
    if (channelError) {
      setError(channelError);
      return;
    }
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
      setError(dict.errorPreviewLoad);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSend() {
    if (recipientMode === "category" && selectedCategoryCount === 0) {
      setError(dict.errorSelectCategory);
      return;
    }
    if (recipientMode === "individual" && selectedRecipientCount === 0) {
      setError(dict.errorSelectContact);
      return;
    }
    if (recipientMode === "quickList" && quickListRecipientCount === 0) {
      setError(dict.errorEnterRecipient);
      return;
    }
    if (!canAct) return;
    const channelError = quickListChannelError();
    if (channelError) {
      setError(channelError);
      return;
    }
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
        setError(dict.errorNoMatchingContacts);
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
              body.error?.message ?? dict.errorSendChannel(CHANNEL_LABEL[channel]),
            );
          }
          created += body.data?.creation?.created ?? 0;
        }
        perChannelCreated[channel] = created;
      }

      const summary = selectedChannels
        .map((channel) => dict.summaryPart(perChannelCreated[channel] ?? 0, CHANNEL_LABEL[channel]))
        .join(", ");
      setSendSummary(dict.sentSummary(recipientCount, summary));
      showToast(dict.messagesSentToast);
      setPreviews({});
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.errorSendGeneric);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-stone-900">{dict.heading}</h2>
        <p className="mt-1 text-sm text-stone-500">
          {dict.subtitle}
        </p>
      </div>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {sendSummary ? (
        <InlineAlert tone="success">
          {sendSummary}{" "}
          <Link href="/dashboard/activity" className="font-medium underline">
            {dict.openActivity}
          </Link>
        </InlineAlert>
      ) : null}

      <section className={FORM_SECTION_CLASS}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-stone-800">{dict.recipients}</span>
          <div className="flex gap-4 text-sm text-stone-700">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="recipient-mode"
              checked={recipientMode === "individual"}
              onChange={() => setRecipientMode("individual")}
            />
            {dict.modeIndividual}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="recipient-mode"
              checked={recipientMode === "category"}
              onChange={() => setRecipientMode("category")}
            />
            {dict.modeCategories}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="recipient-mode"
              checked={recipientMode === "quickList"}
              onChange={() => setRecipientMode("quickList")}
            />
            {dict.modeQuickList}
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
                ? dict.noCategoriesSelected
                : (
                  <>
                    {dict.categoriesSelectedCount(selectedCategoryCount)}
                    <br />
                    {loadingCategoryAudience
                      ? dict.countingUniqueRecipients
                      : dict.uniqueRecipients(categoryAudienceSummary.contactIds.length)}
                  </>
                )}
            </p>
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-700">
            {selectedCategoryCount === 0 ? (
              dict.noCategoriesSelected
            ) : loadingCategoryAudience ? (
              dict.countingRecipients
            ) : (
              <>
                <span className="font-medium text-stone-900">{dict.categoriesSelectedHeading}</span>
                <div className="mt-2 flex flex-col gap-2 text-xs text-stone-600">
                  {selectedCategories.map((category) => {
                    const count = categoryAudienceSummary.categoryCounts[category.id] ?? 0;
                    const preview = categoryAudienceSummary.categoryPreviews[category.id] ?? [];

                    return (
                      <div key={category.id}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate font-medium text-stone-800">
                            {category.name}
                          </span>
                          <span className="shrink-0">
                            {dict.contactsCount(count)}
                          </span>
                        </div>
                        {preview.length > 0 ? (
                          <ul className="mt-1 flex flex-col gap-0.5 pl-2">
                            {preview.map((contact) => (
                              <li key={contact.id} className="flex justify-between gap-3">
                                <span className="min-w-0 truncate">{contact.name}</span>
                                <span className="shrink-0 text-stone-500">{contact.mobile}</span>
                              </li>
                            ))}
                            {count > preview.length ? (
                              <li className="text-stone-500">
                                {dict.moreContacts(count - preview.length)}
                              </li>
                            ) : null}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 border-t border-stone-200 pt-2">
                  <span className="font-medium text-stone-900">{dict.totalUniqueRecipients}</span>
                  <br />
                  {dict.contactsCount(categoryAudienceSummary.contactIds.length)}
                </div>
              </>
            )}
          </div>
          </div>
        ) : recipientMode === "individual" ? (
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-xs font-medium text-stone-700">{dict.selectedContacts}</span>
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
                        aria-label={dict.removeContactAria(recipient.name)}
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-stone-500">{dict.noContactsSelected}</p>
              )}
            </div>

            <div className="relative">
              <input
                className={inputClass}
                placeholder={dict.searchContactsPlaceholder}
                value={recipientQuery}
                onChange={(event) => {
                  setRecipientQuery(event.target.value);
                  setRecipientPage(1);
                }}
              />
              {recipientOptions.length > 0 ? (
                <ul className="mt-2 overflow-hidden rounded-lg border border-stone-200 bg-white">
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
                            aria-label={dict.selectContactAria(option.name)}
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
              ) : recipientsLoaded ? (
                <p className="mt-2 text-xs text-stone-500">{dict.noContactsFound}</p>
              ) : null}
              {recipientTotalPages > 1 ? (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={recipientPage <= 1}
                    onClick={() => setRecipientPage((page) => Math.max(page - 1, 1))}
                  >
                    {dict.previousPage}
                  </button>
                  <span className="text-xs text-stone-600">
                    {dict.pageOf(recipientPage, recipientTotalPages)}
                  </span>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={recipientPage >= recipientTotalPages}
                    onClick={() =>
                      setRecipientPage((page) => Math.min(page + 1, recipientTotalPages))
                    }
                  >
                    {dict.nextPage}
                  </button>
                </div>
              ) : null}
            </div>

            <p className="text-xs text-stone-500">
              {selectedRecipientCount === 0
                ? dict.noContactsSelected
                : dict.contactsSelectedCount(selectedRecipientCount)}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <label className="block text-sm">
              <span className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-stone-700">{dict.quickListLabel}</span>
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
                    {dict.clearList}
                  </button>
                ) : null}
              </span>
              <textarea
                className={`${inputClass} mt-2 min-h-56 resize-y`}
                placeholder={dict.quickListPlaceholder}
                value={quickListInput}
                onChange={(event) => setQuickListInput(event.target.value)}
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <div className="text-xs font-medium text-stone-700">{dict.recipientsHeading}</div>
                {parsedQuickList.valid.length > 0 ? (
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-stone-200 bg-white">
                    {parsedQuickList.valid.slice(0, 100).map((recipient, index) => (
                      <div
                        key={`${recipient.mobile || recipient.email}-${index}`}
                        className="border-b border-stone-100 px-3 py-2 last:border-0"
                      >
                        <div className="text-sm font-medium text-stone-900">
                          {recipient.name}
                        </div>
                        <div className="text-xs text-stone-500">
                          {[recipient.mobile, recipient.email].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    ))}
                    {parsedQuickList.valid.length > 100 ? (
                      <div className="px-3 py-2 text-xs text-stone-500">
                        {dict.moreValidRecipients(parsedQuickList.valid.length - 100)}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-stone-500">{dict.noValidRecipientsYet}</p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-700">
                  <span className="font-medium text-stone-900">
                    {dict.recipientsReady(quickListRecipientCount)}
                  </span>
                  <br />
                  {dict.invalidEntriesCount(parsedQuickList.invalid.length)}
                  {parsedQuickList.duplicates.length > 0 ? (
                    <>
                      <br />
                      {dict.duplicatesIgnored(parsedQuickList.duplicates.length)}
                    </>
                  ) : null}
                </div>

                {parsedQuickList.invalid.length > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <div className="text-xs font-medium text-amber-950">{dict.invalidEntriesHeading}</div>
                    <div className="mt-2 flex max-h-44 flex-col gap-2 overflow-y-auto">
                      {parsedQuickList.invalid.slice(0, 25).map((entry, index) => (
                        <div key={`${entry.line}-${index}`} className="text-xs text-amber-950">
                          <div className="font-medium">{entry.line}</div>
                          <div>{entry.reason}</div>
                        </div>
                      ))}
                      {parsedQuickList.invalid.length > 25 ? (
                        <div className="text-xs text-amber-900">
                          {dict.moreInvalidEntries(parsedQuickList.invalid.length - 25)}
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
          <span className="font-medium text-stone-800">{dict.occasion}</span>
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
        <span className="text-sm font-medium text-stone-800">{dict.deliveryChannels}</span>
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
          <span className="text-sm font-medium text-stone-800">{dict.templatesHeading}</span>
          {selectedChannels.length === 0 ? (
            <p className="text-sm text-stone-500">{dict.chooseAtLeastOneChannel}</p>
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
                        {dict.templateLabel(CHANNEL_LABEL[channel])}
                      </span>
                      <select
                        className={`${inputClass} mt-1`}
                        value={state.templateId}
                        onChange={(event) => setChannelTemplate(channel, event.target.value)}
                      >
                        <option value="">{dict.chooseTemplate}</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                      {templates.length === 0 ? (
                        <span className="mt-1 block text-xs text-stone-500">
                          {dict.noApprovedTemplatesYet(CHANNEL_LABEL[channel])}
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
          {previewing ? dict.loadingPreview : dict.preview}
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => void handleSend()}
          disabled={actionControlsDisabled || sending}
        >
          {sending ? dict.sending : dict.sendNow}
        </button>
      </div>
    </div>
  );
}
