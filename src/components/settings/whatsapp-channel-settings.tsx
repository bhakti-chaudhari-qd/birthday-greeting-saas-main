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
import { getChannelSettingsDict } from "@/lib/i18n/dictionaries/channel-settings";
import { useLocale } from "@/lib/i18n/use-locale";
import { getCustomerWhatsAppProviderLabel } from "@/lib/ui/customer-labels";

type WhatsAppChannelConfigView = {
  channel: "WHATSAPP";
  configured: boolean;
  provider: "TEST" | "CUSTOM_HTTP" | "META" | null;
  isActive: boolean;
  credentialsConfigured: boolean;
  username?: string;
  apiKeyConfigured: boolean;
  accessTokenConfigured: boolean;
  baseUrl?: string;
  sendPath?: string;
  tlsInsecure?: boolean;
  phoneNumberId?: string;
  apiVersion?: string;
  createdAt?: string;
  updatedAt?: string;
  walletBalanceSupported: boolean;
};

type AuthMode = "password" | "apiKey";
type WhatsAppProvider = "CUSTOM_HTTP" | "META";

type FormState = {
  provider: WhatsAppProvider;
  isActive: boolean;
  authMode: AuthMode;
  username: string;
  password: string;
  apiKey: string;
  baseUrl: string;
  sendPath: string;
  tlsInsecure: boolean;
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
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
  tlsInsecure: false,
  accessToken: "",
  phoneNumberId: "",
  apiVersion: "",
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
  const channelDict = getChannelSettingsDict(useLocale());
  const dict = channelDict.whatsapp;
  const common = channelDict.common;
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
          setError(body.error?.message ?? dict.failedToLoad);
          return;
        }

        const data = body.data as WhatsAppChannelConfigView;
        setConfig(data);
        setForm(
          withDemoCustomHttpDefaults({
            provider: data.provider === "META" ? "META" : "CUSTOM_HTTP",
            isActive: data.configured ? data.isActive : true,
            authMode: data.apiKeyConfigured ? "apiKey" : "password",
            username: data.username ?? "",
            password: "",
            apiKey: "",
            baseUrl: data.baseUrl ?? "",
            sendPath: data.sendPath ?? "",
            tlsInsecure: data.tlsInsecure === true,
            accessToken: "",
            phoneNumberId: data.phoneNumberId ?? "",
            apiVersion: data.apiVersion ?? "",
          }),
        );
      } catch {
        setError(dict.failedToLoad);
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

    if (form.provider === "META") {
      payload.phoneNumberId = form.phoneNumberId.trim();
      if (form.apiVersion.trim()) {
        payload.apiVersion = form.apiVersion.trim();
      }
      if (form.accessToken.trim()) {
        payload.accessToken = form.accessToken.trim();
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
        setError(body.error?.message ?? dict.failedToSave);
        return;
      }

      setSuccess(dict.savedSuccess);
      setReloadToken((value) => value + 1);
    } catch {
      setError(dict.failedToSave);
    } finally {
      setSaving(false);
    }
  }

  const isCustomHttp = form.provider === "CUSTOM_HTTP";
  const isMeta = form.provider === "META";
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
  const accessTokenConfigured = Boolean(
    isMeta && config?.provider === "META" && config.accessTokenConfigured,
  );

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <p className="text-sm text-stone-600">{common.loadingConfiguration}</p>
      ) : (
        <>
          <Panel className="p-4 sm:p-5">
            <p className="text-sm font-medium text-stone-800">{dict.walletBalance}</p>
            <p className="mt-1 text-2xl font-semibold text-stone-900">-</p>
            <p className="mt-1 text-sm text-stone-600">
              {config?.walletBalanceSupported
                ? dict.refreshLiveBalance
                : dict.notAvailable}
            </p>
          </Panel>

          <Panel className="p-4 sm:p-5">
            <form className="flex flex-col gap-4" onSubmit={handleSave}>
              <label className="block text-sm">
                <span className="font-medium text-stone-800">{dict.gateway}</span>
                <select
                  className={`${inputClass} mt-1`}
                  value={form.provider}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      provider: event.target.value as WhatsAppProvider,
                    }))
                  }
                >
                  <option value="CUSTOM_HTTP">
                    {getCustomerWhatsAppProviderLabel("CUSTOM_HTTP")}
                  </option>
                  <option value="META">
                    {getCustomerWhatsAppProviderLabel("META")}
                  </option>
                </select>
              </label>

              {isMeta ? (
                <>
                  <label className="block text-sm">
                    <span className="font-medium text-stone-800">
                      {dict.phoneNumberId}
                    </span>
                    <input
                      className={`${inputClass} mt-1`}
                      value={form.phoneNumberId}
                      placeholder="1320947411098948"
                      autoComplete="off"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          phoneNumberId: event.target.value,
                        }))
                      }
                      required
                    />
                    <span className="mt-0.5 block text-xs text-stone-500">
                      {dict.phoneNumberIdHint}
                    </span>
                  </label>

                  <MaskedPasswordField
                    label={dict.accessToken}
                    configured={accessTokenConfigured}
                    value={form.accessToken}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, accessToken: value }))
                    }
                    required={!accessTokenConfigured}
                    hint={accessTokenConfigured ? undefined : dict.accessTokenHint}
                  />

                  <label className="block text-sm">
                    <span className="font-medium text-stone-800">
                      {dict.apiVersionOptional}
                    </span>
                    <input
                      className={`${inputClass} mt-1`}
                      value={form.apiVersion}
                      placeholder="v21.0"
                      autoComplete="off"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          apiVersion: event.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              ) : null}

              {form.provider === "CUSTOM_HTTP" ? (
                <>
                  <label className="block text-sm">
                    <span className="font-medium text-stone-800">{dict.baseUrl}</span>
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
                    <span className="font-medium text-stone-800">{dict.sendPath}</span>
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
                    <span className="font-medium text-stone-800">
                      {dict.authenticationMethod}
                    </span>
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
                      <option value="password">{dict.usernamePassword}</option>
                      <option value="apiKey">{dict.apiKey}</option>
                    </select>
                  </label>

                  {form.authMode === "apiKey" ? (
                    <MaskedPasswordField
                      label={dict.apiKey}
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
                        <span className="font-medium text-stone-800">{dict.username}</span>
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
                        hint={passwordConfigured ? undefined : dict.passwordHint}
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
                        {dict.allowInsecureTls}
                      </span>
                      <span className="mt-0.5 block text-xs text-stone-500">
                        {dict.allowInsecureTlsHint}
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
                {common.active}
              </label>

              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
                <p className="font-medium text-stone-800">{common.currentStatus}</p>
                <p className="mt-1">
                  {config?.configured
                    ? dict.currentStatusConfigured(
                        getCustomerWhatsAppProviderLabel(config.provider),
                        config.isActive ? common.activeWord : common.inactiveWord,
                      )
                    : dict.currentStatusNotConfigured}
                </p>
                {config?.provider === "CUSTOM_HTTP" && config.baseUrl ? (
                  <p className="mt-1 break-all text-xs text-stone-500">
                    {config.baseUrl}
                    {config.sendPath ?? ""}
                  </p>
                ) : null}
                {config?.provider === "META" && config.phoneNumberId ? (
                  <p className="mt-1 break-all text-xs text-stone-500">
                    {dict.phoneNumberIdLabel}: {config.phoneNumberId}
                  </p>
                ) : null}
              </div>

              {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
              {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}

              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={saving} className={primaryButtonClass}>
                  {saving ? common.saving : common.saveConfiguration}
                </button>
                <Link href="/dashboard/messages" className={secondaryButtonClass}>
                  {dict.sendMessages}
                </Link>
              </div>
            </form>
          </Panel>
        </>
      )}
    </div>
  );
}
