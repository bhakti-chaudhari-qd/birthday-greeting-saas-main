"use client";

import { useEffect, useState } from "react";

import { MaskedPasswordField } from "@/components/settings/masked-password-field";
import { InlineAlert } from "@/components/ui/feedback";
import {
  Panel,
  inputClass,
  primaryButtonClass,
} from "@/components/ui/page";
import { getCustomerEmailProviderLabel } from "@/lib/ui/customer-labels";

type EmailChannelConfigView = {
  channel: "EMAIL";
  configured: boolean;
  provider: "TEST" | "RESEND" | null;
  isActive: boolean;
  credentialsConfigured: boolean;
  fromEmail?: string;
  fromName?: string;
  createdAt?: string;
  updatedAt?: string;
};

type FormState = {
  provider: "RESEND";
  isActive: boolean;
  apiKey: string;
  fromEmail: string;
  fromName: string;
};

const emptyForm: FormState = {
  provider: "RESEND",
  isActive: true,
  apiKey: "",
  fromEmail: "",
  fromName: "",
};

export function EmailChannelSettings() {
  const [config, setConfig] = useState<EmailChannelConfigView | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/v1/channel-config/email");
        const body = await response.json();

        if (!response.ok) {
          setError(
            body.error?.message ?? "Failed to load Email channel configuration",
          );
          return;
        }

        const data = body.data as EmailChannelConfigView;
        setConfig(data);
        setForm({
          provider: "RESEND",
          isActive: data.configured ? data.isActive : true,
          apiKey: "",
          fromEmail: data.fromEmail ?? "",
          fromName: data.fromName ?? "",
        });
      } catch {
        setError("Failed to load Email channel configuration");
      } finally {
        setLoading(false);
      }
    }

    void loadConfig();
  }, [reloadToken]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      provider: form.provider,
      isActive: form.isActive,
    };

    if (form.provider === "RESEND") {
      payload.fromEmail = form.fromEmail.trim();
      if (form.fromName.trim()) {
        payload.fromName = form.fromName.trim();
      }
      if (form.apiKey.trim()) {
        payload.apiKey = form.apiKey.trim();
      }
    }

    try {
      const response = await fetch("/api/v1/channel-config/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(
          body.error?.message ?? "Failed to save Email channel configuration",
        );
        return;
      }

      setSuccess("Configuration saved successfully.");
      setReloadToken((current) => current + 1);
    } catch {
      setError("Failed to save Email channel configuration");
    } finally {
      setSaving(false);
    }
  }

  const isResend = form.provider === "RESEND";
  const apiKeyConfigured = Boolean(
    isResend && config?.provider === "RESEND" && config.credentialsConfigured,
  );

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <p className="text-sm text-stone-600">Loading configuration…</p>
      ) : (
        <Panel className="p-4 sm:p-5">
          <form className="flex flex-col gap-4" onSubmit={handleSave}>
            <div className="block text-sm">
              <span className="font-medium text-stone-800">Email service</span>
              <div className="mt-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-stone-700">
                {getCustomerEmailProviderLabel(form.provider)}
              </div>
            </div>

            {isResend ? (
              <>
                <label className="block text-sm">
                  <span className="font-medium text-stone-800">From email</span>
                  <input
                    type="email"
                    className={`${inputClass} mt-1`}
                    value={form.fromEmail}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, fromEmail: event.target.value }))
                    }
                    placeholder="greetings@yourdomain.com"
                    autoComplete="off"
                    required
                  />
                </label>

                <label className="block text-sm">
                  <span className="font-medium text-stone-800">From name (optional)</span>
                  <input
                    className={`${inputClass} mt-1`}
                    value={form.fromName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, fromName: event.target.value }))
                    }
                    placeholder="Birthday Greeting"
                    autoComplete="off"
                  />
                </label>

                <MaskedPasswordField
                  label="Resend API key"
                  configured={apiKeyConfigured}
                  value={form.apiKey}
                  onChange={(value) => setForm((current) => ({ ...current, apiKey: value }))}
                  required
                  hint={apiKeyConfigured ? undefined : "Required the first time you set up Resend."}
                />
              </>
            ) : null}

            <label className="flex items-center gap-2 text-sm text-stone-800">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isActive: event.target.checked }))
                }
              />
              Active
            </label>

            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
              <p className="font-medium text-stone-800">Current status</p>
              <p className="mt-1">
                {config?.configured
                  ? `Configured · ${getCustomerEmailProviderLabel(config.provider)} · ${
                      config.isActive ? "active" : "inactive"
                    }`
                  : "Not configured - Email will use the platform default sender"}
              </p>
              {config?.provider === "RESEND" && config.fromEmail ? (
                <p className="mt-1 break-all text-xs text-stone-500">
                  {config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail}
                </p>
              ) : null}
            </div>

            {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
            {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={saving} className={primaryButtonClass}>
                {saving ? "Saving…" : "Save Configuration"}
              </button>
            </div>
          </form>
        </Panel>
      )}
    </div>
  );
}
