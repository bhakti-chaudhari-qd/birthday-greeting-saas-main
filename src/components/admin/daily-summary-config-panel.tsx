"use client";

import { useState } from "react";

import { MaskedPasswordField } from "@/components/settings/masked-password-field";
import { InlineAlert } from "@/components/ui/feedback";
import {
  Panel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import type { PlatformDailySummarySettings } from "@/lib/daily-summary/platform-config";

/**
 * Platform Admin form for the daily summary: the Meta Cloud API account it is
 * sent from, the approved template, and the send hour. The access token is
 * write-only - once saved it is never sent back to the browser.
 */
export function DailySummaryConfigPanel({
  initial,
}: {
  initial: PlatformDailySummarySettings;
}) {
  const [settings, setSettings] = useState(initial);
  const [accessToken, setAccessToken] = useState("");
  const [testMobile, setTestMobile] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function update<K extends keyof PlatformDailySummarySettings>(
    key: K,
    value: PlatformDailySummarySettings[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v1/admin/daily-summary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: settings.enabled,
          ...(accessToken.trim() ? { accessToken: accessToken.trim() } : {}),
          phoneNumberId: settings.phoneNumberId.trim(),
          apiVersion: settings.apiVersion.trim() || undefined,
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

      setSettings(body.data as PlatformDailySummarySettings);
      setAccessToken("");
      setSuccess("Daily summary settings saved.");
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
      const response = await fetch("/api/v1/admin/daily-summary/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: testMobile }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? "Failed to send the test summary");
        return;
      }

      setSuccess("Test summary accepted by Meta. Check WhatsApp on that number.");
    } catch {
      setError("Failed to send the test summary");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Panel className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-stone-900">Daily summary on WhatsApp</h2>
      <p className="mt-1 text-sm text-stone-600">
        Every client&apos;s Owner gets a WhatsApp summary of the previous day&apos;s
        messages (sent and failed per channel). It is sent from this Meta Cloud API
        account using the approved template below, whose body must have eight
        variables in this order: organization name, date, WhatsApp sent, WhatsApp
        failed, SMS sent, SMS failed, Email sent, Email failed.
      </p>

      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleSave}>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => update("enabled", event.target.checked)}
          />
          <span className="font-medium text-stone-800">Send daily summaries</span>
        </label>

        <div className="sm:col-span-2">
          <MaskedPasswordField
            label="Meta access token"
            configured={settings.configured}
            value={accessToken}
            onChange={setAccessToken}
            required
            hint="Use a permanent system-user token; the temporary dashboard token expires in about a day."
          />
        </div>

        <label className="block text-sm">
          <span className="font-medium text-stone-800">Phone number ID</span>
          <input
            className={`mt-1 ${inputClass}`}
            inputMode="numeric"
            value={settings.phoneNumberId}
            onChange={(event) => update("phoneNumberId", event.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Graph API version</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={settings.apiVersion}
            onChange={(event) => update("apiVersion", event.target.value)}
            placeholder="v21.0"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Template name</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={settings.templateName}
            onChange={(event) => update("templateName", event.target.value)}
            placeholder="daily_summary"
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
          <span className="mt-1 block text-xs text-stone-500">
            en for English, en_US for English (US) - it must match the template.
          </span>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Send time (IST)</span>
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
          <button type="submit" className={primaryButtonClass} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      {settings.configured ? (
        <div className="mt-6 border-t border-stone-200 pt-4">
          <span className="text-sm font-medium text-stone-800">Send a test summary</span>
          <p className="mt-1 text-xs text-stone-500">
            Sends one summary with sample numbers using the saved settings. Save any
            changes above first.
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
