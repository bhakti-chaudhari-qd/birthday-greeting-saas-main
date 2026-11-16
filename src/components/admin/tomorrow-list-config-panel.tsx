"use client";

import { useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import {
  Panel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import type { PlatformTomorrowListSettings } from "@/lib/tomorrow-list/platform-config";

/**
 * Platform Admin form for Tomorrow's List: master switch, the approved
 * template, and the default send hour on the day before. It reuses the Meta
 * account saved under Daily Summary.
 */
export function TomorrowListConfigPanel({
  initial,
}: {
  initial: PlatformTomorrowListSettings;
}) {
  const [settings, setSettings] = useState(initial);
  const [testMobile, setTestMobile] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function update<K extends keyof PlatformTomorrowListSettings>(
    key: K,
    value: PlatformTomorrowListSettings[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

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
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? "Failed to save settings");
        return;
      }

      setSettings(body.data as PlatformTomorrowListSettings);
      setSuccess("Tomorrow's List settings saved.");
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v1/admin/tomorrow-list/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: testMobile }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? "Failed to send the test message");
        return;
      }

      setSuccess(
        "Test accepted by Meta. Its button should open the sample list with made-up names.",
      );
    } catch {
      setError("Failed to send the test message");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Panel className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-stone-900">Tomorrow&apos;s List on WhatsApp</h2>
      <p className="mt-1 text-sm text-stone-600">
        The day before, each client gets a WhatsApp message with a link to the next
        day&apos;s list (name and last 4 digits of the mobile, one section per occasion).
        The link expires at midnight IST at the end of that day. It is sent from the
        Meta account saved under Daily Summary, using the approved template below.
      </p>
      <ul className="mt-2 list-disc pl-5 text-xs text-stone-500">
        <li>
          Body variables, in order: {"{{1}}"} organization name, {"{{2}}"} date,{" "}
          {"{{3}}"} number of people.
        </li>
        <li>
          One <strong>URL button</strong> with a dynamic URL ending in the token, e.g.{" "}
          <code>https://your-domain/t/{"{{1}}"}</code>
        </li>
      </ul>

      {!settings.accountConfigured ? (
        <div className="mt-4">
          <InlineAlert tone="info">
            Save the Meta account under Settings &gt; Daily Summary first.
          </InlineAlert>
        </div>
      ) : null}

      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleSave}>
        <label className="flex items-start gap-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.enabled}
            onChange={(event) => update("enabled", event.target.checked)}
          />
          <span>
            <span className="font-medium text-stone-800">Tomorrow&apos;s List active</span>
            <span className="mt-0.5 block text-xs text-stone-500">
              Unticking stops it for every client. Each client can also be switched off
              on their own page under Clients.
            </span>
          </span>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-stone-800">Template name</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={settings.templateName}
            onChange={(event) => update("templateName", event.target.value)}
            placeholder="tomorrow_list"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Template language</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={settings.language}
            onChange={(event) => update("language", event.target.value)}
            placeholder="en"
            required
          />
        </label>
        <label className="block text-sm">
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

        {error ? (
          <div className="sm:col-span-2">
            <InlineAlert tone="error">{error}</InlineAlert>
          </div>
        ) : null}
        {success ? (
          <div className="sm:col-span-2">
            <InlineAlert tone="success">{success}</InlineAlert>
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={saving || !settings.accountConfigured}
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      {settings.accountConfigured && settings.templateName ? (
        <div className="mt-6 border-t border-stone-200 pt-4">
          <span className="text-sm font-medium text-stone-800">Send a test message</span>
          <p className="mt-1 text-xs text-stone-500">
            Sends one message with sample numbers. Its button opens a sample list. Save
            and activate above first.
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
              disabled={testing || !testMobile.trim()}
            >
              {testing ? "Sending…" : "Send test"}
            </button>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
