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
import { getMessagesDict } from "@/lib/i18n/dictionaries/messages";
import { useLocale } from "@/lib/i18n/use-locale";
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
  usingPlatformDefault?: boolean;
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
  const dict = getMessagesDict(useLocale()).manualSend;
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
      setPreselectNotice(dict.preselectedContacts(ids.length));
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
            (current) => current ?? dict.suggestedTemplate(body.data.categoryName),
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
        setError(dict.errors.failedToLoadTemplates);
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
          setError(body.error?.message ?? dict.errors.failedToLoadAudience);
          return;
        }

        setAudienceMeta({
          total: body.meta?.total ?? 0,
        });
      } catch {
        setError(dict.errors.failedToLoadAudience);
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
          setError(body.error?.message ?? dict.errors.failedToSelectMatching);
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
      setError(dict.errors.failedToSelectMatching);
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
        setEmailError(result.error?.message ?? dict.errors.failedToSaveEmail);
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
      setEmailError(dict.errors.failedToSaveEmail);
    } finally {
      setEmailSaving(false);
    }
  }

  const handlePreview = useCallback(async (templateId = selectedTemplateId) => {
    if (!templateId) {
      setError(dict.errors.selectTemplateFirst);
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
        setError(body.error?.message ?? dict.errors.failedToPreview);
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
      setError(dict.errors.failedToPreview);
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
      setError(dict.errors.selectionChanged);
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
        setSendProgress(dict.sendingBatch(index + 1, batches.length, batch.length));

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
              dict.failedOnBatch(index + 1, batches.length, aggregate.creation.created),
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
          ? dict.networkErrorBatching(aggregate.creation.created)
          : dict.errors.failedToSend,
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
        <h1 className="text-2xl font-semibold text-zinc-900">{dict.pageTitle}</h1>
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
          <h2 className="text-lg font-medium text-zinc-900">{dict.results.heading}</h2>
          <dl className="mt-4 grid gap-2 text-sm text-zinc-700">
            <div>
              <dt className="inline font-medium">{dict.results.batches}</dt>{" "}
              <dd className="inline">
                {sendResult.batchesSucceeded} of {sendResult.batchesTotal}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium">{dict.results.queued}</dt>{" "}
              <dd className="inline">{sendResult.queued.created}</dd>
            </div>
            <div>
              <dt className="inline font-medium">{dict.results.requested}</dt>{" "}
              <dd className="inline">{sendResult.queued.requested}</dd>
            </div>
            <div>
              <dt className="inline font-medium">{dict.results.skippedLimit}</dt>{" "}
              <dd className="inline">{sendResult.queued.skippedLimit}</dd>
            </div>
          </dl>
          {sendResult.creation.skippedLimit > 0 ? (
            <p className="mt-4 text-sm text-amber-700">
              {dict.results.skippedRecipients(sendResult.creation.skippedLimit)}
            </p>
          ) : null}
          {sendResult.batchesSucceeded < sendResult.batchesTotal ? (
            <div className="mt-4">
              <PageHint
                action={
                  <>
                    <SecondaryButtonLink href="/dashboard/activity?tab=upcoming">
                      {dict.results.openActivity}
                    </SecondaryButtonLink>
                    <SecondaryButtonLink href="/dashboard/activity?tab=sent">
                      {dict.results.viewSubmitted}
                    </SecondaryButtonLink>
                  </>
                }
              >
                {dict.results.someBatchesIncomplete}
              </PageHint>
            </div>
          ) : null}
          <div className="mt-4">
            <PageHint
              action={
                <>
                  <SecondaryButtonLink href="/dashboard/activity?tab=upcoming">
                    {dict.results.viewActivity}
                  </SecondaryButtonLink>
                  <SecondaryButtonLink
                    href="#automatic-greetings"
                  >
                    {dict.results.setupAutomatic}
                  </SecondaryButtonLink>
                </>
              }
            >
              {dict.results.backgroundSendingNote}
            </PageHint>
          </div>
          <div className="mt-6">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={resetFlow}
            >
              {dict.results.sendAnother}
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
                  {dict.setup.channelLabel}
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
                  <p className="mt-2 text-sm text-zinc-600">{dict.setup.emailHint}</p>
                ) : null}
                {sendChannel === "WHATSAPP" &&
                !channelConfig?.usingPlatformDefault &&
                (!channelConfig?.configured || !channelConfig.isActive) ? (
                  <div className="mt-2">
                    <p className="text-sm text-amber-800">
                      {dict.setup.whatsappNotConfigured}
                    </p>
                    <div className="mt-2">
                      <SecondaryButtonLink href="/dashboard/settings/channels?tab=whatsapp">
                        {dict.setup.configureWhatsapp}
                      </SecondaryButtonLink>
                    </div>
                  </div>
                ) : null}
                {sendChannel === "WHATSAPP" &&
                channelConfig?.configured &&
                channelConfig.isActive ? (
                  <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                    <p>
                      <span className="font-medium">{dict.setup.sendModeLabel}</span>{" "}
                      {channelConfig.provider === "CUSTOM_HTTP"
                        ? dict.setup.customHttpMode
                        : dict.setup.testMode}
                    </p>
                    {channelConfig.provider !== "CUSTOM_HTTP" ? (
                      <p className="mt-1 text-xs text-amber-800">
                        {dict.setup.switchToCustomHttp}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  {dict.setup.savedMessagesLabel}
                </label>
                {loadingSetup ? (
                  <p className="mt-2 text-sm text-zinc-600">
                    {dict.setup.loadingTemplates}
                  </p>
                ) : eligibleTemplates.length === 0 ? (
                  <div className="mt-2 text-sm text-zinc-600">
                    <p>
                      {sendChannel === "SMS"
                        ? dict.setup.noSmsReady
                        : dict.setup.noSavedMessages(channelLabel)}
                    </p>
                    {isCustomHttp ? (
                      <div className="mt-2">
                        <SecondaryButtonLink href="/dashboard/settings/sms/templates">
                          {dict.setup.configureAdvancedSms}
                        </SecondaryButtonLink>
                      </div>
                    ) : sendChannel === "SMS" ? (
                      <div className="mt-2">
                        <SecondaryButtonLink href="/dashboard/settings/channels">
                          {dict.setup.openChannels}
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
                      <option value="">{dict.setup.selectSavedMessage}</option>
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
                  <p className="text-sm font-semibold text-zinc-900">{dict.audience.heading}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {loadingAudience
                      ? dict.audience.countingContacts
                      : audienceMeta?.total != null
                        ? dict.audience.activeContacts(audienceMeta.total)
                        : dict.audience.noAudienceData}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                    {dict.audience.selectedContacts(selectedContactIds.length)}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-zinc-700">
                        {dict.audience.categoryLabel}
                      </span>
                      <select
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                      >
                        <option value="all">{dict.audience.allCategories}</option>
                        {categories.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-zinc-700">
                        {dict.audience.searchLabel}
                      </span>
                      <input
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        placeholder={
                          sendChannel === "EMAIL"
                            ? dict.audience.searchPlaceholderEmail
                            : dict.audience.searchPlaceholderDefault
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
                      {selectingAll ? dict.audience.selecting : dict.audience.selectMatchingAudience}
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
                      {dict.audience.clearSelection}
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
                      {preview.recipientCount === 0
                        ? dict.preview.messagePreviewHeading
                        : dict.preview.confirmSendHeading}
                    </h2>
                    <dl className="mt-4 grid gap-2 text-sm text-zinc-700">
                      <div>
                        <dt className="inline font-medium">{dict.preview.messageLabel}</dt>{" "}
                        <dd className="inline">{preview.template.name}</dd>
                      </div>
                      {preview.recipientCount > 0 ? (
                        <div>
                          <dt className="inline font-medium">{dict.preview.recipientsLabel}</dt>{" "}
                          <dd className="inline">{preview.recipientCount}</dd>
                        </div>
                      ) : (
                        <div>
                          <dt className="inline font-medium">{dict.preview.recipientsLabel}</dt>{" "}
                          <dd className="inline">{dict.preview.noneSelected}</dd>
                        </div>
                      )}
                      {preview.recipientCount > MANUAL_SEND_API_BATCH_SIZE ? (
                        <div>
                          <dt className="inline font-medium">{dict.preview.batchesLabel}</dt>{" "}
                          <dd className="inline">
                            {dict.preview.batchesOfUpTo(
                              getManualSendBatchCount(preview.recipientCount),
                              MANUAL_SEND_API_BATCH_SIZE,
                            )}
                          </dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="inline font-medium">{dict.preview.modeLabel}</dt>{" "}
                        <dd className="inline">{preview.providerModeLabel}</dd>
                      </div>
                    </dl>
                    {preview.recipientCount === 0 ? (
                      <p className="mt-3 text-sm text-amber-800">
                        {dict.preview.samplePreviewNote}
                      </p>
                    ) : null}
                    {preview.recipientCount > 0 && preview.providerModeLabel === "Test mode" ? (
                      <p className="mt-3 text-sm text-amber-800">
                        {sendChannel === "EMAIL"
                          ? dict.preview.testModeEmailNote
                          : dict.preview.testModeGenericNote}
                      </p>
                    ) : null}
                    {preview.recipientCount > 0 && (preview.providerModeLabel === "Custom HTTP" || preview.providerModeLabel === "Resend") ? (
                      <p className="mt-3 text-sm text-zinc-600">
                        {dict.preview.backgroundNote}
                      </p>
                    ) : null}
                    {preview.recipientCount > MANUAL_SEND_API_BATCH_SIZE ? (
                      <p className="mt-3 text-sm text-zinc-600">
                        {dict.preview.firstBatchNote(preview.recipientCount)}
                      </p>
                    ) : null}
                    {previewSamples.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-zinc-700">
                          {preview.recipientCount === 0
                            ? dict.preview.sampleMessageLabel
                            : dict.preview.samplePreviewsLabel}
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
                      <p className="mt-4 text-sm text-zinc-600">{dict.preview.monthlyLimitNote}</p>
                    ) : null}
                    <div className="mt-6 flex flex-wrap gap-3">
                      {preview.recipientCount > 0 ? (
                        <button type="button" className={primaryButtonClass} disabled={sending} onClick={() => void handleSend()}>
                          {sending
                            ? sendProgress ?? dict.preview.confirming
                            : preview.recipientCount > MANUAL_SEND_API_BATCH_SIZE
                              ? dict.preview.confirmSendBatches(
                                  getManualSendBatchCount(preview.recipientCount),
                                )
                              : dict.preview.confirmSend}
                        </button>
                      ) : null}
                      <button type="button" className={secondaryButtonClass} disabled={sending} onClick={() => setStep("select")}>
                        {dict.preview.back}
                      </button>
                    </div>
                  </>
                )}
              </section>
            ) : sendChannel === "EMAIL" && !showComposer ? (
              <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-lg font-medium text-zinc-900">{dict.emailComposer.heading}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                      {dict.emailComposer.description}
                    </p>
                  </div>

                  <label className="block text-sm">
                    <span className="font-medium text-zinc-800">{dict.emailComposer.subjectLabel}</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                      value={emailSubject}
                      onChange={(event) => setEmailSubject(event.target.value)}
                      placeholder={dict.emailComposer.subjectPlaceholder}
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-zinc-800">{dict.emailComposer.messageLabel}</span>
                    <textarea
                      className="mt-1 min-h-32 w-full rounded-lg border border-zinc-300 px-3 py-2"
                      value={emailBody}
                      onChange={(event) => setEmailBody(event.target.value)}
                      placeholder={dict.emailComposer.messagePlaceholder}
                    />
                  </label>

                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
                    <p className="font-medium text-zinc-800">{dict.emailComposer.previewLabel}</p>
                    {emailSubject.trim() || emailBody.trim() ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-zinc-500">
                          <span className="font-medium">{dict.emailComposer.subjectPrefix}</span>{" "}
                          {emailSubject.replace(/\{\{name\}\}/g, "Alex") || dict.emailComposer.noSubject}
                        </p>
                        <p className="whitespace-pre-wrap rounded bg-white p-2 text-zinc-900">
                          {emailBody.replace(/\{\{name\}\}/g, "Alex") || dict.emailComposer.noMessage}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 text-zinc-500">{dict.emailComposer.enterToPreview}</p>
                    )}
                  </div>

                  {emailSaving ? (
                    <p className="text-sm text-zinc-600">{dict.emailComposer.saving}</p>
                  ) : (
                    <button
                      type="button"
                      className={primaryButtonClass}
                      disabled={!emailSubject.trim() || !emailBody.trim()}
                      onClick={() => void handleSaveEmail()}
                    >
                      {dict.emailComposer.saveMessage}
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
                    <h2 className="text-lg font-medium text-zinc-900">{dict.emptyState.heading}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                      {dict.emptyState.description}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-900">{dict.emptyState.nextStepHeading}</p>
                    <ul className="mt-3 space-y-2">
                      <li>{dict.emptyState.step1}</li>
                      <li>{dict.emptyState.step2}</li>
                      <li>{dict.emptyState.step3}</li>
                    </ul>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      className={primaryButtonClass}
                      disabled={previewing || sending || !selectedTemplateId}
                      onClick={() => void handlePreview()}
                    >
                      {previewing ? dict.emptyState.previewing : dict.emptyState.previewMessages}
                    </button>
                    <p className="text-sm text-zinc-600">
                      {selectedTemplateId
                        ? dict.emptyState.previewHintSelected
                        : dict.emptyState.previewHintNone}
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