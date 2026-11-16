"use client";

import { useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import {
  Panel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import type { TomorrowListTemplateStatus } from "@/lib/tomorrow-list/meta-template";
import type { PlatformTomorrowListSettings } from "@/lib/tomorrow-list/platform-config";

type Notice = { tone: "error" | "success"; text: string } | null;

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-800",
};

function NoticeLine({ notice }: { notice: Notice }) {
  return notice ? (
    <div className="mt-3">
      <InlineAlert tone={notice.tone}>{notice.text}</InlineAlert>
    </div>
  ) : null;
}

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as {
    data?: unknown;
    error?: { message?: string };
  };
}

/**
 * Platform Admin controls for Tomorrow's List, in three steps: create the
 * WhatsApp template in Meta (and check its approval), switch the list on
 * with a default send time, and send a test. Uses the Meta account saved in
 * the Daily Summary section above.
 */
export function TomorrowListConfigPanel({
  initial,
  defaults,
}: {
  initial: PlatformTomorrowListSettings;
  defaults: {
    templateName: string;
    body: string;
    buttonText: string;
    baseUrl: string;
  };
}) {
  const [settings, setSettings] = useState({
    ...initial,
    templateName: initial.templateName || defaults.templateName,
  });
  const [body, setBody] = useState(defaults.body);
  const [buttonText, setButtonText] = useState(defaults.buttonText);
  const [baseUrl, setBaseUrl] = useState(defaults.baseUrl);
  const [templateStatus, setTemplateStatus] =
    useState<TomorrowListTemplateStatus | null>(null);
  const [testMobile, setTestMobile] = useState("");
  const [busy, setBusy] = useState<null | "submit" | "status" | "save" | "test">(null);
  const [templateNotice, setTemplateNotice] = useState<Notice>(null);
  const [saveNotice, setSaveNotice] = useState<Notice>(null);
  const [testNotice, setTestNotice] = useState<Notice>(null);

  function update<K extends keyof PlatformTomorrowListSettings>(
    key: K,
    value: PlatformTomorrowListSettings[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  const previewBody = body
    .replace("{{1}}", "Sharma Clinic")
    .replace("{{2}}", "17 Nov 2026")
    .replace("{{3}}", "5");

  async function handleSubmitTemplate() {
    setBusy("submit");
    setTemplateNotice(null);
    try {
      const response = await fetch("/api/v1/admin/tomorrow-list/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappBusinessAccountId: settings.whatsappBusinessAccountId.trim(),
          templateName: settings.templateName.trim(),
          language: settings.language.trim(),
          body,
          buttonText,
          baseUrl,
        }),
      });
      const json = await readJson(response);
      if (!response.ok) {
        setTemplateNotice({
          tone: "error",
          text: json.error?.message ?? "Failed to submit the template",
        });
        return;
      }
      setTemplateStatus(json.data as TomorrowListTemplateStatus);
      setTemplateNotice({
        tone: "success",
        text: "Submitted to Meta. Approval usually takes a few minutes; use Check status.",
      });
    } catch {
      setTemplateNotice({ tone: "error", text: "Failed to submit the template" });
    } finally {
      setBusy(null);
    }
  }

  async function handleCheckStatus() {
    setBusy("status");
    setTemplateNotice(null);
    try {
      const response = await fetch("/api/v1/admin/tomorrow-list/template");
      const json = await readJson(response);
      if (!response.ok) {
        setTemplateNotice({
          tone: "error",
          text: json.error?.message ?? "Failed to check the template status",
        });
        return;
      }
      setTemplateStatus(json.data as TomorrowListTemplateStatus);
    } catch {
      setTemplateNotice({ tone: "error", text: "Failed to check the template status" });
    } finally {
      setBusy(null);
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("save");
    setSaveNotice(null);
    try {
      const response = await fetch("/api/v1/admin/tomorrow-list", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: settings.enabled,
          templateName: settings.templateName.trim(),
          language: settings.language.trim(),
          sendHour: settings.sendHour,
        }),
      });
      const json = await readJson(response);
      if (!response.ok) {
        setSaveNotice({
          tone: "error",
          text: json.error?.message ?? "Failed to save settings",
        });
        return;
      }
      setSettings(json.data as PlatformTomorrowListSettings);
      setSaveNotice({ tone: "success", text: "Tomorrow's List settings saved." });
    } catch {
      setSaveNotice({ tone: "error", text: "Failed to save settings" });
    } finally {
      setBusy(null);
    }
  }

  async function handleTest() {
    setBusy("test");
    setTestNotice(null);
    try {
      const response = await fetch("/api/v1/admin/tomorrow-list/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: testMobile }),
      });
      const json = await readJson(response);
      if (!response.ok) {
        setTestNotice({
          tone: "error",
          text: json.error?.message ?? "Failed to send the test message",
        });
        return;
      }
      setTestNotice({
        tone: "success",
        text: "Test accepted by Meta. Its button should open the sample list with made-up names.",
      });
    } catch {
      setTestNotice({ tone: "error", text: "Failed to send the test message" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-stone-900">Tomorrow&apos;s List on WhatsApp</h2>
      <p className="mt-1 text-sm text-stone-600">
        The day before, each client gets a WhatsApp message with a link to the next
        day&apos;s list (name and last 4 digits of the mobile, one section per occasion).
        The link expires at midnight IST at the end of that day. It is sent from the
        Meta account saved in the Daily Summary section above.
      </p>

      {!settings.accountConfigured ? (
        <div className="mt-4">
          <InlineAlert tone="info">
            Save the Meta account in the Daily Summary section above first.
          </InlineAlert>
        </div>
      ) : null}

      {/* Step 1: template */}
      <section className="mt-5 rounded-lg border border-stone-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-stone-900">
            1. Create the template in Meta
          </h3>
          {templateStatus ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                STATUS_STYLES[templateStatus.status] ?? "bg-stone-200 text-stone-700"
              }`}
            >
              {templateStatus.name} ({templateStatus.language}):{" "}
              {templateStatus.status.replace("_", " ")}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-stone-500">
          Submits a Utility template with one &quot;view list&quot; link button. Keep{" "}
          {"{{1}}"} organization name, {"{{2}}"} date and {"{{3}}"} number of people in
          the text. If the template already exists in Meta, just fill in its name and
          language in step 2.
        </p>
        {templateStatus?.rejectedReason ? (
          <div className="mt-3">
            <InlineAlert tone="error">
              Meta rejected it: {templateStatus.rejectedReason}. Change the text, use a
              new template name and submit again.
            </InlineAlert>
          </div>
        ) : null}

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-stone-800">WhatsApp Business Account ID</span>
            <input
              className={`mt-1 ${inputClass}`}
              inputMode="numeric"
              value={settings.whatsappBusinessAccountId}
              onChange={(event) => update("whatsappBusinessAccountId", event.target.value)}
              placeholder="e.g. 102290129340398"
            />
            <span className="mt-1 block text-xs text-stone-500">
              Meta Business Suite &gt; WhatsApp Manager &gt; Account tools &gt; Phone
              numbers: the &quot;WhatsApp Business Account ID&quot; (not the phone number
              ID). The access token needs the whatsapp_business_management permission.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">Template name</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={settings.templateName}
              onChange={(event) => update("templateName", event.target.value)}
              placeholder="tomorrow_list"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">Template language</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={settings.language}
              onChange={(event) => update("language", event.target.value)}
              placeholder="en"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-stone-800">Message text</span>
            <textarea
              className={`mt-1 min-h-24 ${inputClass}`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={1024}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">Button text</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={buttonText}
              onChange={(event) => setButtonText(event.target.value)}
              maxLength={25}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">Site address</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://www.birthdaywishs.in"
            />
            <span className="mt-1 block text-xs text-stone-500">
              The button opens {baseUrl.replace(/\/+$/, "") || "https://…"}/t/…
            </span>
          </label>
        </div>

        <div className="mt-4 max-w-sm rounded-lg bg-[#e7f3e3] p-3 text-sm text-stone-800">
          <p className="whitespace-pre-wrap">{previewBody}</p>
          <p className="mt-2 border-t border-stone-300/70 pt-2 text-center font-medium text-sky-700">
            ↗ {buttonText || "View list"}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => void handleSubmitTemplate()}
            disabled={busy !== null || !settings.accountConfigured}
          >
            {busy === "submit" ? "Submitting…" : "Submit to Meta for approval"}
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => void handleCheckStatus()}
            disabled={busy !== null || !settings.accountConfigured}
          >
            {busy === "status" ? "Checking…" : "Check status"}
          </button>
        </div>
        <NoticeLine notice={templateNotice} />
      </section>

      {/* Step 2: switch on */}
      <form className="mt-4 rounded-lg border border-stone-200 p-4" onSubmit={handleSave}>
        <h3 className="text-sm font-semibold text-stone-900">2. Switch it on</h3>
        <label className="mt-3 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.enabled}
            onChange={(event) => update("enabled", event.target.checked)}
          />
          <span>
            <span className="font-medium text-stone-800">Tomorrow&apos;s List active</span>
            <span className="mt-0.5 block text-xs text-stone-500">
              Tick once the template is approved. Uses the template name and language
              from step 1. Unticking stops it for every client; each client can also be
              switched off on their own page under Clients.
            </span>
          </span>
        </label>
        <label className="mt-4 block max-w-xs text-sm">
          <span className="font-medium text-stone-800">
            Default send time, day before (IST)
          </span>
          <select
            className={`mt-1 ${inputClass}`}
            value={settings.sendHour}
            onChange={(event) => update("sendHour", Number(event.target.value))}
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour}>
                {`${String(hour).padStart(2, "0")}:00`}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-stone-500">
            Used for clients who have not picked their own time.
          </span>
        </label>
        <button
          type="submit"
          className={`mt-4 ${primaryButtonClass}`}
          disabled={busy !== null || !settings.accountConfigured}
        >
          {busy === "save" ? "Saving…" : "Save settings"}
        </button>
        <NoticeLine notice={saveNotice} />
      </form>

      {/* Step 3: test */}
      <section className="mt-4 rounded-lg border border-stone-200 p-4">
        <h3 className="text-sm font-semibold text-stone-900">3. Send a test</h3>
        <p className="mt-1 text-xs text-stone-500">
          Sends one message with sample numbers. Its button opens a sample list with
          made-up names. Needs step 2 saved as active.
        </p>
        <div className="mt-2 flex max-w-md gap-2">
          <input
            type="tel"
            inputMode="tel"
            className={inputClass}
            placeholder="10-digit WhatsApp number"
            value={testMobile}
            onChange={(event) => setTestMobile(event.target.value)}
          />
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => void handleTest()}
            disabled={busy !== null || !testMobile.trim()}
          >
            {busy === "test" ? "Sending…" : "Send test"}
          </button>
        </div>
        <NoticeLine notice={testNotice} />
      </section>
    </Panel>
  );
}
