"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { MaskedPasswordField } from "@/components/settings/masked-password-field";
import { InlineAlert } from "@/components/ui/feedback";
import {
  Panel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import { getCustomerWhatsAppProviderLabel } from "@/lib/ui/customer-labels";

type WhatsAppChannelConfigView = {
  channel: "WHATSAPP";
  configured: boolean;
  provider: "TEST" | "CUSTOM_HTTP" | null;
  isActive: boolean;
  credentialsConfigured: boolean;
  username?: string;
  apiKeyConfigured: boolean;
  baseUrl?: string;
  sendPath?: string;
  tlsInsecure?: boolean;
  createdAt?: string;
  updatedAt?: string;
  walletBalanceSupported: boolean;
};

type AuthMode = "password" | "apiKey";

type FormState = {
  provider: "CUSTOM_HTTP";
  isActive: boolean;
  authMode: AuthMode;
  username: string;
  password: string;
  apiKey: string;
  baseUrl: string;
  sendPath: string;
  tlsInsecure: boolean;
};

const emptyForm: FormState = {
  provider: "CUSTOM_HTTP",
  isActive: true,
  authMode: "password",
  username: "",
  password: "",
  apiKey: "",
  baseUrl: "",
  sendPath: "",
  tlsInsecure: true,
};

/** Local-only demo Custom HTTP defaults for provider testing. Never prefilled in production. */
const DEMO_WHATSAPP_CUSTOM_HTTP = {
  baseUrl: "https://45.114.141.55",
  sendPath: "/api/CustomAPI/CustomAPI_SendWhatsApp",
  username: "innovartic",
} as const;

const isLocalDemoPrefill = process.env.NODE_ENV === "development";

function withDemoCustomHttpDefaults(form: FormState): FormState {
  if (!isLocalDemoPrefill) {
    return form;
  }

  return {
    ...form,
    baseUrl: form.baseUrl.trim() || DEMO_WHATSAPP_CUSTOM_HTTP.baseUrl,
    sendPath: form.sendPath.trim() || DEMO_WHATSAPP_CUSTOM_HTTP.sendPath,
    username: form.username.trim() || DEMO_WHATSAPP_CUSTOM_HTTP.username,
    tlsInsecure: form.tlsInsecure,
  };
}

export function WhatsAppChannelSettings() {
  const [config, setConfig] = useState<WhatsAppChannelConfigView | null>(null);
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
        const response = await fetch("/api/v1/channel-config/whatsapp");
        const body = await response.json();

        if (!response.ok) {
          setError(
            body.error?.message ??
              "Failed to load WhatsApp channel configuration",
          );
          return;
        }

        const data = body.data as WhatsAppChannelConfigView;
        setConfig(data);
        setForm(
          withDemoCustomHttpDefaults({
            provider: "CUSTOM_HTTP",
            isActive: data.configured ? data.isActive : true,
            authMode: data.apiKeyConfigured ? "apiKey" : "password",
            username: data.username ?? "",
            password: "",
            apiKey: "",
            baseUrl: data.baseUrl ?? "",
            sendPath: data.sendPath ?? "",
            tlsInsecure: data.tlsInsecure !== false,
          }),
        );
      } catch {
        setError("Failed to load WhatsApp channel configuration");
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

    if (form.provider === "CUSTOM_HTTP") {
      payload.baseUrl = form.baseUrl.trim();
      payload.sendPath = form.sendPath.trim();
      payload.tlsInsecure = form.tlsInsecure;

      if (form.authMode === "apiKey") {
        if (form.apiKey.trim()) {
          payload.apiKey = form.apiKey.trim();
        }
      } else {
        payload.username = form.username;
        if (form.password.trim()) {
          payload.password = form.password;
        }
      }
    }

    try {
      const response = await fetch("/api/v1/channel-config/whatsapp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(
          body.error?.message ?? "Failed to save WhatsApp channel configuration",
        );
        return;
      }

      setSuccess("Configuration saved successfully.");
      setReloadToken((value) => value + 1);
    } catch {
      setError("Failed to save WhatsApp channel configuration");
    } finally {
      setSaving(false);
    }
  }

  const isCustomHttp = form.provider === "CUSTOM_HTTP";
  const isSameConfiguredProvider =
    isCustomHttp && config?.provider === "CUSTOM_HTTP";
  const passwordConfigured = Boolean(
    isSameConfiguredProvider &&
      form.authMode === "password" &&
      config.credentialsConfigured,
  );
  const apiKeyConfigured = Boolean(
    isSameConfiguredProvider &&
      form.authMode === "apiKey" &&
      config.apiKeyConfigured,
  );

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <p className="text-sm text-stone-600">Loading configuration…</p>
      ) : (
        <>
          <Panel className="p-4 sm:p-5">
            <p className="text-sm font-medium text-stone-800">WhatsApp wallet balance</p>
            <p className="mt-1 text-2xl font-semibold text-stone-900">-</p>
            <p className="mt-1 text-sm text-stone-600">
              {config?.walletBalanceSupported
                ? "Refresh to load your live WhatsApp gateway balance."
                : "Not available from the current WhatsApp provider."}
            </p>
          </Panel>

          <Panel className="p-4 sm:p-5">
            <form className="flex flex-col gap-4" onSubmit={handleSave}>
              <div className="block text-sm">
                <span className="font-medium text-stone-800">WhatsApp gateway</span>
                <div className="mt-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-stone-700">
                  {getCustomerWhatsAppProviderLabel(form.provider)}
                </div>
              </div>

              {form.provider === "CUSTOM_HTTP" ? (
                <>
                  <label className="block text-sm">
                    <span className="font-medium text-stone-800">Base URL</span>
                    <input
                      className={`${inputClass} mt-1`}
                      value={form.baseUrl}
                      placeholder="https://your-provider.example"
                      autoComplete="off"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, baseUrl: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium text-stone-800">Send path</span>
                    <input
                      className={`${inputClass} mt-1`}
                      value={form.sendPath}
                      placeholder="/api/CustomAPI/CustomAPI_SendWhatsApp"
                      autoComplete="off"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, sendPath: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium text-stone-800">Authentication method</span>
                    <select
                      className={`${inputClass} mt-1`}
                      value={form.authMode}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          authMode: event.target.value as AuthMode,
                          password: "",
                          apiKey: "",
                        }))
                      }
                    >
                      <option value="password">Username &amp; Password</option>
                      <option value="apiKey">API Key</option>
                    </select>
                  </label>

                  {form.authMode === "apiKey" ? (
                    <MaskedPasswordField
                      label="API Key"
                      configured={apiKeyConfigured}
                      value={form.apiKey}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, apiKey: value }))
                      }
                      required
                    />
                  ) : (
                    <>
                      <label className="block text-sm">
                        <span className="font-medium text-stone-800">Username</span>
                        <input
                          className={`${inputClass} mt-1`}
                          value={form.username}
                          autoComplete="username"
                          onChange={(event) =>
                            setForm((current) => ({ ...current, username: event.target.value }))
                          }
                          required
                        />
                      </label>

                      <MaskedPasswordField
                        configured={passwordConfigured}
                        value={form.password}
                        onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                        hint={
                          passwordConfigured ? undefined : "Leave blank if your provider doesn't require one."
                        }
                      />
                    </>
                  )}

                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={form.tlsInsecure}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, tlsInsecure: event.target.checked }))
                      }
                    />
                    <span>
                      <span className="font-medium text-stone-800">
                        Allow insecure TLS (testing)
                      </span>
                      <span className="mt-0.5 block text-xs text-stone-500">
                        For self-signed test gateways.
                      </span>
                    </span>
                  </label>
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
                    ? `Configured · ${getCustomerWhatsAppProviderLabel(
                        config.provider,
                      )} · ${config.isActive ? "active" : "inactive"}`
                    : "Not configured - WhatsApp Send will fail closed"}
                </p>
                {config?.provider === "CUSTOM_HTTP" && config.baseUrl ? (
                  <p className="mt-1 break-all text-xs text-stone-500">
                    {config.baseUrl}
                    {config.sendPath ?? ""}
                  </p>
                ) : null}
              </div>

              {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
              {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}

              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={saving} className={primaryButtonClass}>
                  {saving ? "Saving…" : "Save Configuration"}
                </button>
                <Link href="/dashboard/messages" className={secondaryButtonClass}>
                  Send Messages
                </Link>
              </div>
            </form>
          </Panel>
        </>
      )}
    </div>
  );
}
