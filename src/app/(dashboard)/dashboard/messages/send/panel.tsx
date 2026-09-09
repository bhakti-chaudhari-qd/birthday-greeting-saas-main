"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHint } from "@/components/ui/feedback";
import { PersonalizedWhatsAppPreview } from "@/components/activity/message-preview-dialog";
import {
  SecondaryButtonLink,
  compactSecondaryButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import {
  MANUAL_SEND_API_BATCH_SIZE,
  MANUAL_SEND_PRESELECT_STORAGE_KEY,
  chunkIds,
  getManualSendBatchCount,
} from "@/lib/queue/manual-send-batches";

type ContactCategoryOption = {
  id: string;
  name: string;
};

type AudienceMeta = {
  total: number;
};

type TemplateOption = {
  id: string;
  name: string;
  occasionName?: string | null;
  type?: "BIRTHDAY" | "ANNIVERSARY" | "CUSTOM";
  channel: string;
  isActive: boolean;
  realSmsReady: boolean;
  realSmsStatusLabel: string;
  whatsappMediaAssetId?: string | null;
};

type ChannelConfigSummary = {
  configured: boolean;
  provider: "TEST" | "CUSTOM_HTTP" | null;
  isActive: boolean;
};

type PreviewItem = {
  contactId: string;
  contactName: string;
  renderedPreview: string;
};

type PreviewData = {
  template: {
    id: string;
    name: string;
    channel?: string;
    realSmsStatusLabel: string;
  };
  providerMode: "TEST" | "CUSTOM_HTTP";
  providerModeLabel: "Test mode" | "Custom HTTP" | "Resend";
  recipientCount: number;
  media: {
    filename: string;
    contentType: string;
    previewUrl: string;
  } | null;
  previews: PreviewItem[];
};

type ManualSendResult = {
  batchesTotal: number;
  batchesSucceeded: number;
  creation: {
    operationIds: string[];
    requested: number;
    created: number;
    skippedLimit: number;
    queueIds: string[];
  };
  queued: {
    requested: number;
    created: number;
    skippedLimit: number;
  };
};

type FlowStep = "select" | "confirm" | "results";

function buildSelectionKey(templateId: string, contactIds: string[]) {
  const sortedIds = [...contactIds].sort();
  let hash = 5381;

  for (const id of sortedIds) {
    for (let i = 0; i < id.length; i += 1) {
      hash = ((hash << 5) + hash + id.charCodeAt(i)) >>> 0;
    }
    hash = ((hash << 5) + hash + 31) >>> 0;
  }

  return `${templateId}:${contactIds.length}:${hash}`;
}

export function ManualSendPanel() {
  const [audienceMeta, setAudienceMeta] = useState<AudienceMeta | null>(null);
  const [categories, setCategories] = useState<ContactCategoryOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [sendChannel, setSendChannel] = useState<"SMS" | "WHATSAPP" | "EMAIL">(
    "SMS",
  );
  const [channelConfig, setChannelConfig] = useState<ChannelConfigSummary | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [confirmedSelectionKey, setConfirmedSelectionKey] = useState<
    string | null
  >(null);
  const [sendResult, setSendResult] = useState<ManualSendResult | null>(null);
  const [step, setStep] = useState<FlowStep>("select");
  const [error, setError] = useState<string | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(true);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<string | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);
  const [preselectNotice, setPreselectNotice] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const isCustomHttp =
    sendChannel === "SMS" &&
    channelConfig?.configured &&
    channelConfig.isActive &&
    channelConfig.provider === "CUSTOM_HTTP";

  const eligibleTemplates = useMemo(() => {
    if (sendChannel === "WHATSAPP") {
      return templates.filter((template) => template.channel === "WHATSAPP");
    }

    if (sendChannel === "EMAIL") {
      return templates.filter((template) => template.channel === "EMAIL");
    }

    if (!isCustomHttp) {
      return templates.filter((template) => template.channel === "SMS");
    }

    return templates.filter(
      (template) => template.channel === "SMS" && template.realSmsReady,
    );
  }, [isCustomHttp, sendChannel, templates]);

  const channelLabel =
    sendChannel === "WHATSAPP"
      ? "WhatsApp"
      : sendChannel === "EMAIL"
        ? "Email"
        : "SMS";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requestedChannel = new URLSearchParams(window.location.search).get(
        "channel",
      );
      if (
        requestedChannel === "SMS" ||
        requestedChannel === "WHATSAPP" ||
        requestedChannel === "EMAIL"
      ) {
        setSendChannel(requestedChannel);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(MANUAL_SEND_PRESELECT_STORAGE_KEY);
      if (!raw) {
        return;
      }
      sessionStorage.removeItem(MANUAL_SEND_PRESELECT_STORAGE_KEY);
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }
      const ids = [
        ...new Set(
          parsed.filter(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          ),
        ),
      ];

      if (ids.length === 0) {
        return;
      }

      // Existing selection is external session state restored on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedContactIds(ids);
      setPreselectNotice(
        `${ids.length} contact${ids.length === 1 ? "" : "s"} preselected from Contacts.`,
      );
    } catch {
      // Ignore invalid stored selection.
    }
  }, []);

  useEffect(() => {
    if (selectedContactIds.length === 0) {
      return;
    }

    let cancelled = false;

    async function loadCategoryDefaults() {
      if (selectedContactIds.length > 200) {
        return;
      }

      try {
        const params = new URLSearchParams({
          occasionType: "BIRTHDAY",
          contactIds: selectedContactIds.join(","),
        });
        const response = await fetch(
          `/api/v1/manual-send/category-defaults?${params.toString()}`,
        );
        const body = await response.json();
        if (!response.ok || cancelled) {
          return;
        }

        const suggestedTemplateId =
          sendChannel === "WHATSAPP"
            ? (body.data?.whatsappTemplateId as string | null)
            : sendChannel === "EMAIL"
              ? (body.data?.emailTemplateId as string | null)
              : (body.data?.smsTemplateId as string | null);

        if (!suggestedTemplateId) {
          return;
        }

        setSelectedTemplateId((current) => {
          if (current) {
            return current;
          }
          return suggestedTemplateId;
        });

        if (body.data?.categoryName) {
          setPreselectNotice(
            (current) =>
              current ??
              `Suggested template from category \u201c${body.data.categoryName}\u201d. You can change it.`,
          );
        }
      } catch {
        // Non-blocking suggestion.
      }
    }

    void loadCategoryDefaults();
    return () => {
      cancelled = true;
    };
  }, [selectedContactIds, sendChannel]);

  useEffect(() => {
    async function loadSetup() {
      setLoadingSetup(true);
      setSelectedTemplateId("");
      setPreview(null);
      setConfirmedSelectionKey(null);
      setStep("select");
      setShowComposer(false);
      setEmailSubject("");
      setEmailBody("");
      setEmailError(null);

      try {
        const templatesResponse = await fetch(
          `/api/v1/templates?isActive=true&channel=${sendChannel}&limit=100`,
        );
        const templatesBody = await templatesResponse.json();

        if (templatesResponse.ok) {
          setTemplates(templatesBody.data);
        } else {
          setTemplates([]);
        }

        if (sendChannel === "EMAIL") {
          setChannelConfig(null);
        } else {
          const channelPath =
            sendChannel === "WHATSAPP"
              ? "/api/v1/channel-config/whatsapp"
              : "/api/v1/channel-config/sms";
          const channelResponse = await fetch(channelPath);
          const channelBody = await channelResponse.json();

          if (channelResponse.ok) {
            setChannelConfig(channelBody.data);
          } else {
            setChannelConfig(null);
          }
        }
      } catch {
        setError("Failed to load templates");
      } finally {
        setLoadingSetup(false);
      }
    }

    void loadSetup();
  }, [sendChannel]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch("/api/v1/contact-categories");
        const body = await response.json();
        if (!response.ok) {
          return;
        }
        setCategories(
          (body.data as ContactCategoryOption[]).map((item) => ({
            id: item.id,
            name: item.name,
          })),
        );
      } catch {
        // Categories are optional for audience filtering.
      }
    }

    void loadCategories();
  }, []);

  useEffect(() => {
    async function loadAudience() {
      setLoadingAudience(true);
      setError(null);

      const params = new URLSearchParams({
        page: "1",
        limit: "1",
        isActive: "true",
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }
      if (categoryId !== "all") {
        params.set("categoryId", categoryId);
      }

      try {
        const response = await fetch(`/api/v1/contacts?${params.toString()}`);
        const body = await response.json();

        if (!response.ok) {
          setError(body.error?.message ?? "Failed to load audience");
          return;
        }

        setAudienceMeta({
          total: body.meta?.total ?? 0,
        });
      } catch {
        setError("Failed to load audience");
      } finally {
        setLoadingAudience(false);
      }
    }

    const timer = window.setTimeout(() => {
      void loadAudience();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search, categoryId]);

  function buildAudienceParams(pageNumber: number, limit: string) {
    const params = new URLSearchParams({
      page: String(pageNumber),
      limit,
      isActive: "true",
    });
    if (search.trim()) {
      params.set("search", search.trim());
    }
    if (categoryId !== "all") {
      params.set("categoryId", categoryId);
    }
    return params;
  }

  async function handleSelectAllMatching() {
    setSelectingAll(true);
    setError(null);

    try {
      const collected: string[] = [];
      let nextPage = 1;
      let totalPages = 1;

      while (nextPage <= totalPages) {
        const params = buildAudienceParams(nextPage, "100");
        const response = await fetch(`/api/v1/contacts?${params.toString()}`);
        const body = await response.json();

        if (!response.ok) {
          setError(body.error?.message ?? "Failed to select matching contacts");
          return;
        }

        const pageContacts = body.data as { id: string }[];
        totalPages = body.meta?.totalPages ?? 1;

        for (const contact of pageContacts) {
          if (!collected.includes(contact.id)) {
            collected.push(contact.id);
          }
        }

        nextPage += 1;
      }

      setSelectedContactIds(collected);
      setPreview(null);
      setConfirmedSelectionKey(null);
      setStep("select");
    } catch {
      setError("Failed to select matching contacts");
    } finally {
      setSelectingAll(false);
    }
  }

  function invalidatePreview() {
    setPreview(null);
    setConfirmedSelectionKey(null);
    setStep("select");
  }

  async function handleSaveEmail() {
    if (!emailSubject.trim() || !emailBody.trim()) {
      return;
    }

    setEmailSaving(true);
    setEmailError(null);

    try {
      const response = await fetch("/api/v1/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: emailSubject.trim().replace(/\{\{name\}\}/g, "Name"),
          type: "BIRTHDAY",
          channel: "EMAIL",
          body: emailBody.trim(),
          emailSubject: emailSubject.trim(),
          categoryId: null,
          isActive: true,
          replaceExisting: true,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setEmailError(result.error?.message ?? "Failed to save email");
        return;
      }

      // Refresh templates and select the new one
      const templatesResponse = await fetch(
        `/api/v1/templates?isActive=true&channel=EMAIL&limit=100`,
      );
      const templatesBody = await templatesResponse.json();
      if (templatesResponse.ok) {
        setTemplates(templatesBody.data);
      }

      setSelectedTemplateId(result.data.id);
      setShowComposer(false);
      setEmailSubject("");
      setEmailBody("");
      invalidatePreview();
    } catch {
      setEmailError("Failed to save email");
    } finally {
      setEmailSaving(false);
    }
  }

  const handlePreview = useCallback(async (templateId = selectedTemplateId) => {
    if (!templateId) {
      setError("Select a template first");
      return;
    }


    setPreviewing(true);
    setError(null);
    setSendResult(null);
    const previewRequestKey = buildSelectionKey(
      templateId,
      selectedContactIds,
    );
    const previewBatch = selectedContactIds.slice(0, MANUAL_SEND_API_BATCH_SIZE);

    try {
      const response = await fetch("/api/v1/manual-send/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          contactIds: previewBatch,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? "Failed to preview messages");
        return;
      }

      const currentSelectionKey = buildSelectionKey(
        templateId,
        selectedContactIds,
      );
      if (previewRequestKey !== currentSelectionKey) {
        return;
      }

      const previewData = body.data as PreviewData;
      setPreview({
        ...previewData,
        recipientCount: selectedContactIds.length,
      });
      setConfirmedSelectionKey(
        selectedContactIds.length > 0 ? previewRequestKey : null,
      );
      setStep("confirm");
    } catch {
      setError("Failed to preview messages");
    } finally {
      setPreviewing(false);
    }
  }, [selectedContactIds, selectedTemplateId]);

  async function handleSend() {
    if (!selectedTemplateId || selectedContactIds.length === 0) {
      return;
    }

    const currentSelectionKey = buildSelectionKey(
      selectedTemplateId,
      selectedContactIds,
    );
    if (
      !preview ||
      !confirmedSelectionKey ||
      currentSelectionKey !== confirmedSelectionKey
    ) {
      setError("Selection changed since preview. Preview again before sending.");
      invalidatePreview();
      return;
    }

    const batches = chunkIds(selectedContactIds, MANUAL_SEND_API_BATCH_SIZE);
    setSending(true);
    setError(null);
    setSendProgress(null);

    const aggregate: ManualSendResult = {
      batchesTotal: batches.length,
      batchesSucceeded: 0,
      creation: {
        operationIds: [],
        requested: 0,
        created: 0,
        skippedLimit: 0,
        queueIds: [],
      },
      queued: {
        requested: 0,
        created: 0,
        skippedLimit: 0,
      },
    };

    try {
      const clientOperationId = crypto.randomUUID();

      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index]!;
        setSendProgress(
          `Sending batch ${index + 1} of ${batches.length} (${batch.length} recipients)\u2026`,
        );

        const response = await fetch("/api/v1/manual-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: selectedTemplateId,
            contactIds: batch,
            clientOperationId,
          }),
        });
        const body = await response.json();

        if (!response.ok) {
          setError(
            body.error?.message ??
              `Failed on batch ${index + 1} of ${batches.length}. ${aggregate.creation.created} message(s) were already queued.`,
          );
          if (aggregate.creation.created > 0) {
            setSendResult(aggregate);
            setStep("results");
          }
          return;
        }

        const data = body.data as {
          creation: {
            operationId: string;
            requested: number;
            created: number;
            skippedLimit: number;
            queueIds: string[];
          };
          queued: {
            requested: number;
            created: number;
            skippedLimit: number;
          };
        };

        aggregate.batchesSucceeded += 1;
        aggregate.creation.operationIds.push(data.creation.operationId);
        aggregate.creation.requested += data.creation.requested;
        aggregate.creation.created += data.creation.created;
        aggregate.creation.skippedLimit += data.creation.skippedLimit;
        aggregate.creation.queueIds.push(...data.creation.queueIds);
        aggregate.queued.requested += data.queued.requested;
        aggregate.queued.created += data.queued.created;
        aggregate.queued.skippedLimit += data.queued.skippedLimit;
      }

      setSendResult(aggregate);
      setStep("results");
      setSelectedContactIds([]);
    } catch {
      setError(
        aggregate.creation.created > 0
          ? `Network error while batching. ${aggregate.creation.created} message(s) were already queued.`
          : "Failed to send messages",
      );
      if (aggregate.creation.created > 0) {
        setSendResult(aggregate);
        setStep("results");
      }
    } finally {
      setSending(false);
      setSendProgress(null);
    }
  }

  function resetFlow() {
    setPreview(null);
    setConfirmedSelectionKey(null);
    setSendResult(null);
    setStep("select");
    setError(null);
    setSendProgress(null);
  }

  const previewSamples = preview?.previews.slice(0, 3) ?? [];
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Send Messages</h1>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {preselectNotice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {preselectNotice}
        </p>
      ) : null}

      {step === "results" && sendResult ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-zinc-900">Greeting ready</h2>
          <dl className="mt-4 grid gap-2 text-sm text-zinc-700">
            <div>
              <dt className="inline font-medium">Batches:</dt>{" "}
              <dd className="inline">
                {sendResult.batchesSucceeded} of {sendResult.batchesTotal}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium">Queued:</dt>{" "}
              <dd className="inline">{sendResult.queued.created}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Requested:</dt>{" "}
              <dd className="inline">{sendResult.queued.requested}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Skipped (limit):</dt>{" "}
              <dd className="inline">{sendResult.queued.skippedLimit}</dd>
            </div>
          </dl>
          {sendResult.creation.skippedLimit > 0 ? (
            <p className="mt-4 text-sm text-amber-700">
              {sendResult.creation.skippedLimit} recipient
              {sendResult.creation.skippedLimit === 1 ? "" : "s"} skipped
              (monthly limit reached).
            </p>
          ) : null}
          {sendResult.batchesSucceeded < sendResult.batchesTotal ? (
            <div className="mt-4">
              <PageHint
                action={
                  <>
                    <SecondaryButtonLink href="/dashboard/activity?tab=upcoming">
                      Open Activity
                    </SecondaryButtonLink>
                    <SecondaryButtonLink href="/dashboard/activity?tab=sent">
                      View submitted
                    </SecondaryButtonLink>
                  </>
                }
              >
                Some batches did not complete. Check Scheduled and Submitted
                in Activity.
              </PageHint>
            </div>
          ) : null}
          <div className="mt-4">
            <PageHint
              action={
                <>
                  <SecondaryButtonLink href="/dashboard/activity?tab=upcoming">
                    View activity
                  </SecondaryButtonLink>
                  <SecondaryButtonLink
                    href="#automatic-greetings"
                  >
                    Set up automatic sending
                  </SecondaryButtonLink>
                </>
              }
            >
              Your greeting is being sent in the background. Open Activity to
              check the result.
            </PageHint>
          </div>
          <div className="mt-6">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={resetFlow}
            >
              Send another greeting
            </button>
          </div>
        </section>
      ) : null}

      {step !== "results" ? (
        <>
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Channel
                </label>
                <select
                  className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  value={sendChannel}
                  onChange={(event) => {
                    setSendChannel(
                      event.target.value as "SMS" | "WHATSAPP" | "EMAIL",
                    );
                    setStep("select");
                  }}
                >
                  <option value="SMS">SMS</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                </select>
                {sendChannel === "EMAIL" ? (
                  <p className="mt-2 text-sm text-zinc-600">
                    Emails send via platform Resend. Contacts need an email
                    address.
                  </p>
                ) : null}
                {sendChannel === "WHATSAPP" &&
                (!channelConfig?.configured || !channelConfig.isActive) ? (
                  <div className="mt-2">
                    <p className="text-sm text-amber-800">
                      WhatsApp channel must be configured before sending.
                    </p>
                    <div className="mt-2">
                      <SecondaryButtonLink href="/dashboard/settings/channels?tab=whatsapp">
                        Configure WhatsApp channel
                      </SecondaryButtonLink>
                    </div>
                  </div>
                ) : null}
                {sendChannel === "WHATSAPP" &&
                channelConfig?.configured &&
                channelConfig.isActive ? (
                  <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                    <p>
                      <span className="font-medium">Send mode:</span>{" "}
                      {channelConfig.provider === "CUSTOM_HTTP"
                        ? "Custom HTTP (live gateway)"
                        : "Test (simulated - nothing is delivered to a real phone)"}
                    </p>
                    {channelConfig.provider !== "CUSTOM_HTTP" ? (
                      <p className="mt-1 text-xs text-amber-800">
                        Switch to Custom HTTP under WhatsApp settings to
                        deliver to real numbers.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Saved Messages
                </label>
                {loadingSetup ? (
                  <p className="mt-2 text-sm text-zinc-600">
                    Loading templates...
                  </p>
                ) : eligibleTemplates.length === 0 ? (
                  <div className="mt-2 text-sm text-zinc-600">
                    <p>
                      {sendChannel === "SMS"
                        ? "No SMS messages ready to send. Configure live SMS under Settings \u2192 Channels, then use Advanced SMS Setup for provider-approved templates."
                        : sendChannel === "EMAIL"
                          ? `No saved ${channelLabel} messages yet. Create one below.`
                          : `No saved ${channelLabel} messages yet. Create one below.`}
                    </p>
                    {isCustomHttp ? (
                      <div className="mt-2">
                        <SecondaryButtonLink href="/dashboard/settings/sms/templates">
                          Configure Advanced SMS Setup
                        </SecondaryButtonLink>
                      </div>
                    ) : sendChannel === "SMS" ? (
                      <div className="mt-2">
                        <SecondaryButtonLink href="/dashboard/settings/channels">
                          Open Channels
                        </SecondaryButtonLink>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2">
                    <select
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                      value={selectedTemplateId}
                      onChange={(event) => {
                        const nextTemplateId = event.target.value;
                        setSelectedTemplateId(nextTemplateId);
                        const selected = eligibleTemplates.find(
                          (template) => template.id === nextTemplateId,
                        );
                        if (selected?.type) {
                          invalidatePreview();
                        }
                        if (nextTemplateId) {
                          void handlePreview(nextTemplateId);
                        }
                      }}
                    >
                      <option value="">Select a saved message</option>
                      {eligibleTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 border-t border-zinc-200 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Audience</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {loadingAudience
                      ? "Counting active contacts\u2026"
                      : audienceMeta?.total != null
                        ? `${audienceMeta.total} active contact${audienceMeta.total === 1 ? "" : "s"}.`
                        : "No audience data available."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                    Selected {selectedContactIds.length} contact{selectedContactIds.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-zinc-700">
                        Category
                      </span>
                      <select
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                      >
                        <option value="all">All categories</option>
                        {categories.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-zinc-700">
                        Search
                      </span>
                      <input
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        placeholder={
                          sendChannel === "EMAIL"
                            ? "Name, mobile, or email"
                            : "Name or mobile"
                        }
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={compactSecondaryButtonClass}
                      disabled={
                        selectingAll ||
                        loadingAudience ||
                        (audienceMeta?.total ?? 0) === 0
                      }
                      onClick={() => void handleSelectAllMatching()}
                    >
                      {selectingAll ? "Selecting\u2026" : "Select matching audience"}
                    </button>
                    <button
                      type="button"
                      className={[
                        compactSecondaryButtonClass,
                        "border-transparent bg-transparent text-stone-600 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900",
                      ].join(" ")}
                      disabled={selectedContactIds.length === 0}
                      onClick={() => {
                        setSelectedContactIds([]);
                        invalidatePreview();
                      }}
                    >
                      Clear selection
                    </button>
                  </div>
                </div>
            </div>
          </section>

          <div>
            {preview ? (
              <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                {sendChannel === "WHATSAPP" && previewSamples[0] ? (
                  <PersonalizedWhatsAppPreview
                    contactName={previewSamples[0].contactName}
                    messageBody={previewSamples[0].renderedPreview}
                    mediaPreviewUrl={preview.media?.previewUrl ?? null}
                    mediaFilename={preview.media?.filename ?? null}
                    mediaContentType={preview.media?.contentType ?? null}
                    occasionName={
                      templates.find((t) => t.id === selectedTemplateId)
                        ?.occasionName
                    }
                  />
                ) : (
                  <>
                    <h2 className="text-lg font-medium text-zinc-900">
                      {preview.recipientCount === 0 ? "Message preview" : "Confirm send"}
                    </h2>
                    <dl className="mt-4 grid gap-2 text-sm text-zinc-700">
                      <div>
                        <dt className="inline font-medium">Message:</dt>{" "}
                        <dd className="inline">{preview.template.name}</dd>
                      </div>
                      {preview.recipientCount > 0 ? (
                        <div>
                          <dt className="inline font-medium">Recipients:</dt>{" "}
                          <dd className="inline">{preview.recipientCount}</dd>
                        </div>
                      ) : (
                        <div>
                          <dt className="inline font-medium">Recipients:</dt>{" "}
                          <dd className="inline">None selected (sample preview)</dd>
                        </div>
                      )}
                      {preview.recipientCount > MANUAL_SEND_API_BATCH_SIZE ? (
                        <div>
                          <dt className="inline font-medium">Batches:</dt>{" "}
                          <dd className="inline">
                            {getManualSendBatchCount(preview.recipientCount)} sends of up to {MANUAL_SEND_API_BATCH_SIZE}
                          </dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="inline font-medium">Mode:</dt>{" "}
                        <dd className="inline">{preview.providerModeLabel}</dd>
                      </div>
                    </dl>
                    {preview.recipientCount === 0 ? (
                      <p className="mt-3 text-sm text-amber-800">
                        This is a sample preview with placeholder name &ldquo;Alex&rdquo;. Select recipients below, then preview again to confirm send.
                      </p>
                    ) : null}
                    {preview.recipientCount > 0 && preview.providerModeLabel === "Test mode" ? (
                      <p className="mt-3 text-sm text-amber-800">
                        {sendChannel === "EMAIL"
                          ? "Test mode queues a simulated email only. It will not be delivered."
                          : "Test mode queues a simulated send only. It will not arrive on a real phone."}
                      </p>
                    ) : null}
                    {preview.recipientCount > 0 && (preview.providerModeLabel === "Custom HTTP" || preview.providerModeLabel === "Resend") ? (
                      <p className="mt-3 text-sm text-zinc-600">
                        Queued messages are sent in the background. Check Scheduled while pending, then Submitted in Activity for the outcome.
                      </p>
                    ) : null}
                    {preview.recipientCount > MANUAL_SEND_API_BATCH_SIZE ? (
                      <p className="mt-3 text-sm text-zinc-600">
                        Previews show the first batch. All {preview.recipientCount} recipients will be queued.
                      </p>
                    ) : null}
                    {previewSamples.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-zinc-700">
                          {preview.recipientCount === 0 ? "Sample message" : "Sample previews"}
                        </p>
                        <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                          {previewSamples.map((item) => (
                            <li key={item.contactId} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                              <span className="font-medium text-zinc-800">{item.contactName}:</span> {item.renderedPreview}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {preview.recipientCount > 0 ? (
                      <p className="mt-4 text-sm text-zinc-600">Counts toward your monthly limit.</p>
                    ) : null}
                    <div className="mt-6 flex flex-wrap gap-3">
                      {preview.recipientCount > 0 ? (
                        <button type="button" className={primaryButtonClass} disabled={sending} onClick={() => void handleSend()}>
                          {sending
                            ? sendProgress ?? "Confirming\u2026"
                            : preview.recipientCount > MANUAL_SEND_API_BATCH_SIZE
                              ? `Confirm Send (${getManualSendBatchCount(preview.recipientCount)} batches)`
                              : "Confirm Send"}
                        </button>
                      ) : null}
                      <button type="button" className={secondaryButtonClass} disabled={sending} onClick={() => setStep("select")}>
                        Back
                      </button>
                    </div>
                  </>
                )}
              </section>
            ) : sendChannel === "EMAIL" && !showComposer ? (
              <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-lg font-medium text-zinc-900">Create email message</h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                      Write your email and save it as a template. No recipients needed to preview.
                    </p>
                  </div>

                  <label className="block text-sm">
                    <span className="font-medium text-zinc-800">Subject</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                      value={emailSubject}
                      onChange={(event) => setEmailSubject(event.target.value)}
                      placeholder="Happy Birthday {{name}}!"
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-zinc-800">Message</span>
                    <textarea
                      className="mt-1 min-h-32 w-full rounded-lg border border-zinc-300 px-3 py-2"
                      value={emailBody}
                      onChange={(event) => setEmailBody(event.target.value)}
                      placeholder="Happy Birthday {{name}}! Wishing you a wonderful day."
                    />
                  </label>

                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
                    <p className="font-medium text-zinc-800">Preview</p>
                    {emailSubject.trim() || emailBody.trim() ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-zinc-500">
                          <span className="font-medium">Subject:</span>{" "}
                          {emailSubject.replace(/\{\{name\}\}/g, "Alex") || "(no subject)"}
                        </p>
                        <p className="whitespace-pre-wrap rounded bg-white p-2 text-zinc-900">
                          {emailBody.replace(/\{\{name\}\}/g, "Alex") || "(empty message)"}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 text-zinc-500">Enter a subject and message to preview.</p>
                    )}
                  </div>

                  {emailSaving ? (
                    <p className="text-sm text-zinc-600">Saving...</p>
                  ) : (
                    <button
                      type="button"
                      className={primaryButtonClass}
                      disabled={!emailSubject.trim() || !emailBody.trim()}
                      onClick={() => void handleSaveEmail()}
                    >
                      Save message
                    </button>
                  )}

                  {emailError ? (
                    <p className="text-sm text-red-600">{emailError}</p>
                  ) : null}
                </div>
              </section>
            ) : (
              <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-lg font-medium text-zinc-900">Message preview</h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                      Select a saved message and audience, then generate a preview.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-900">Next step</p>
                    <ul className="mt-3 space-y-2">
                      <li>1. Pick a saved message.</li>
                      <li>2. Choose recipients or refine your audience.</li>
                      <li>3. Click Preview to verify before sending.</li>
                    </ul>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      className={primaryButtonClass}
                      disabled={previewing || sending || !selectedTemplateId}
                      onClick={() => void handlePreview()}
                    >
                      {previewing ? "Previewing..." : "Preview messages"}
                    </button>
                    <p className="text-sm text-zinc-600">
                      {selectedTemplateId
                        ? "Preview shows a sample message. Select recipients to confirm send."
                        : "Choose a saved message first."}
                    </p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
        </>
      ) : null}
    </main>
  );
}