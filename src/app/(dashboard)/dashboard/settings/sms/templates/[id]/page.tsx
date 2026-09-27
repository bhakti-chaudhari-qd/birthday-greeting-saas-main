"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useOccasions } from "@/components/occasions/use-occasions";
import { SecondaryButtonLink } from "@/components/ui/page";
import { getSmsSettingsDict } from "@/lib/i18n/dictionaries/sms-settings";
import { useLocale } from "@/lib/i18n/use-locale";

type SmsSetupView = {
  id: string;
  name: string;
  occasionId: string;
  body: string;
  dltTemplateId: string | null;
  dltApprovedContent: string | null;
  compatibility: {
    compatible: boolean;
    issues: string[];
  };
  realSmsReady: boolean;
  realSmsReadinessIssues: string[];
  realSmsStatusLabel: string;
  requiresPairReviewAcknowledgement: boolean;
};

export default function AdvancedSmsTemplateSetupPage() {
  const dict = getSmsSettingsDict(useLocale()).setup;
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const templateId = params.id;
  const { occasions } = useOccasions();

  const [setup, setSetup] = useState<SmsSetupView | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [occasionId, setOccasionId] = useState("");
  const [dltTemplateId, setDltTemplateId] = useState("");
  const [dltApprovedContent, setDltApprovedContent] = useState("");
  const [confirmDltPairReviewed, setConfirmDltPairReviewed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadSetup() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/v1/templates/${templateId}/sms-setup`,
        );
        const body = await response.json();

        if (!response.ok) {
          setError(body.error?.message ?? dict.failedToLoad);
          return;
        }

        const data = body.data as SmsSetupView;
        setSetup(data);
        setTemplateName(data.name);
        setOccasionId(data.occasionId);
        setDltTemplateId(data.dltTemplateId ?? "");
        setDltApprovedContent(data.dltApprovedContent ?? "");
      } catch {
        setError(dict.failedToLoad);
      } finally {
        setLoading(false);
      }
    }

    void loadSetup();
  }, [templateId]);

  const pairChanged =
    setup &&
    ((setup.dltTemplateId?.trim() ?? "") !== dltTemplateId.trim() ||
      (setup.dltApprovedContent?.trim() ?? "") !== dltApprovedContent.trim());

  const needsAcknowledgement = Boolean(
    setup?.requiresPairReviewAcknowledgement && pairChanged,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      dltTemplateId,
      dltApprovedContent,
    };

    if (needsAcknowledgement) {
      payload.confirmDltPairReviewed = confirmDltPairReviewed;
    }

    try {
      if (
        setup &&
        (templateName.trim() !== setup.name.trim() ||
          occasionId !== setup.occasionId)
      ) {
        const nameResponse = await fetch(`/api/v1/templates/${templateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: templateName, occasionId }),
        });
        const nameBody = await nameResponse.json();

        if (!nameResponse.ok) {
          setError(nameBody.error?.message ?? dict.failedToSaveName);
          return;
        }
      }

      const response = await fetch(
        `/api/v1/templates/${templateId}/sms-setup`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? dict.failedToSave);
        return;
      }

      const data = body.data as SmsSetupView;
      setSetup(data);
      setTemplateName(data.name);
      setOccasionId(data.occasionId);
      setDltTemplateId(data.dltTemplateId ?? "");
      setDltApprovedContent(data.dltApprovedContent ?? "");
      setConfirmDltPairReviewed(false);
      setSuccess(dict.saved);
      router.refresh();
    } catch {
      setError(dict.failedToSave);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">
          {dict.heading}
        </h1>
      </div>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">{dict.important}</p>
        <p className="mt-1">
          {dict.importantBody}
        </p>
      </section>

      {loading ? (
        <p className="text-sm text-zinc-600">{dict.loading}</p>
      ) : setup ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
            <p className="font-medium text-zinc-900">{dict.readiness}</p>
            <p className="mt-1">{setup.realSmsStatusLabel}</p>
            {setup.realSmsReadinessIssues.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600">
                {setup.realSmsReadinessIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
            <p className="font-medium text-zinc-900">{dict.applicationTemplateBody}</p>
            <p className="mt-1 whitespace-pre-wrap text-zinc-700">{setup.body}</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm">
              <span className="font-medium text-zinc-800">
                {dict.dltTemplateName}
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                required
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-zinc-800">{dict.occasion}</span>
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
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

            <label className="block text-sm">
              <span className="font-medium text-zinc-800">{dict.dltTemplateId}</span>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                value={dltTemplateId}
                onChange={(event) => setDltTemplateId(event.target.value)}
                required
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-zinc-800">
                {dict.approvedDltContent}
              </span>
              <textarea
                className="mt-1 min-h-32 w-full rounded-lg border border-zinc-300 px-3 py-2"
                value={dltApprovedContent}
                onChange={(event) =>
                  setDltApprovedContent(event.target.value)
                }
                required
              />
            </label>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <p className="font-medium text-zinc-900">{dict.compatibility}</p>
              <p className="mt-1">
                {setup.compatibility.compatible
                  ? dict.compatible
                  : dict.incompatible}
              </p>
              {setup.compatibility.issues.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600">
                  {setup.compatibility.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            {needsAcknowledgement ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmDltPairReviewed}
                  onChange={(event) =>
                    setConfirmDltPairReviewed(event.target.checked)
                  }
                  className="mt-1"
                />
                <span>
                  {dict.acknowledgement}
                </span>
              </label>
            ) : null}

            <button
              type="submit"
              disabled={saving || (needsAcknowledgement && !confirmDltPairReviewed)}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
            >
              {saving ? dict.saving : dict.saveAction}
            </button>
          </form>

          {success ? <p className="mt-4 text-sm text-green-700">{success}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </section>
      ) : (
        <p className="text-sm text-red-600">{error ?? dict.templateNotFound}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <SecondaryButtonLink href="/dashboard/settings/sms/templates">
          {dict.allSmsTemplates}
        </SecondaryButtonLink>
        <SecondaryButtonLink href="/dashboard/settings/channels">
          {dict.channelsLink}
        </SecondaryButtonLink>
      </div>
    </main>
  );
}
