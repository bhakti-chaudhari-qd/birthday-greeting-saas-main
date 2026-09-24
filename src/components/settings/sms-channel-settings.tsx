"use client";

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
import { getCustomerSmsProviderLabel } from "@/lib/ui/customer-labels";

type SmsChannelConfigView = {
  channel: "SMS";
  configured: boolean;
  provider: "TEST" | "CUSTOM_HTTP" | null;
  isActive: boolean;
  credentialsConfigured: boolean;
  username?: string;
  baseUrl?: string;
  sendPath?: string;
  route?: string;
  senderId?: string;
  requestTimeoutMs?: number;
  successStatusCode?: number;
  createdAt?: string;
  updatedAt?: string;
  verificationSupported: boolean;
  walletBalanceSupported: boolean;
  usingPlatformDefault?: boolean;
};

type SmsWalletBalanceView = {
  provider: "TEST" | "CUSTOM_HTTP";
  walletBalanceSupported: boolean;
  balanceCredits: number | null;
  message: string;
};

type FormState = {
  provider: "CUSTOM_HTTP";
  isActive: boolean;
  username: string;
  password: string;
  baseUrl: string;
  sendPath: string;
  route: string;
  senderId: string;
  requestTimeoutSeconds: string;
  successStatusCode: string;
};

const emptyForm: FormState = {
  provider: "CUSTOM_HTTP",
  isActive: true,
  username: "",
  password: "",
  baseUrl: "",
  sendPath: "",
  route: "",
  senderId: "",
  requestTimeoutSeconds: "30",
  successStatusCode: "1",
};

/** Local-only demo Custom HTTP defaults for provider testing. Never prefilled in production. */
const DEMO_SMS_CUSTOM_HTTP = {
  baseUrl: "http://173.45.76.227",
  sendPath: "/send.aspx",
  username: "quick.design",
  route: "trans1",
  senderId: "QDTECH",
} as const;

const isLocalDemoPrefill = process.env.NODE_ENV === "development";

function withDemoCustomHttpDefaults(form: FormState): FormState {
  if (!isLocalDemoPrefill) {
    return form;
  }

  return {
    ...form,
    baseUrl: form.baseUrl.trim() || DEMO_SMS_CUSTOM_HTTP.baseUrl,
    sendPath: form.sendPath.trim() || DEMO_SMS_CUSTOM_HTTP.sendPath,
    username: form.username.trim() || DEMO_SMS_CUSTOM_HTTP.username,
    route: form.route.trim() || DEMO_SMS_CUSTOM_HTTP.route,
    senderId: form.senderId.trim() || DEMO_SMS_CUSTOM_HTTP.senderId,
  };
}

export function SmsChannelSettings() {
  const channelDict = getChannelSettingsDict(useLocale());
  const dict = channelDict.sms;
  const common = channelDict.common;
  const [config, setConfig] = useState<SmsChannelConfigView | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [walletBalance, setWalletBalance] = useState<SmsWalletBalanceView | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/v1/channel-config/sms");
        const body = await response.json();

        if (!response.ok) {
          setError(body.error?.message ?? dict.failedToLoad);
          return;
        }

        const data = body.data as SmsChannelConfigView;
        setConfig(data);
        setForm(
          withDemoCustomHttpDefaults({
            provider: "CUSTOM_HTTP",
            isActive: data.configured ? data.isActive : true,
            username: data.username ?? "",
            password: "",
            baseUrl: data.baseUrl ?? "",
            sendPath: data.sendPath ?? "",
            route: data.route ?? "",
            senderId: data.senderId ?? "",
            requestTimeoutSeconds: String(
              Math.round((data.requestTimeoutMs ?? 30_000) / 1000),
            ),
            successStatusCode: String(data.successStatusCode ?? 1),
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

  useEffect(() => {
    async function loadBalance() {
      if (!config?.configured) {
        setWalletBalance(null);
        return;
      }

      setRefreshingBalance(true);

      try {
        const response = await fetch("/api/v1/channel-config/sms/balance");
        const body = await response.json();

        if (!response.ok) {
          return;
        }

        setWalletBalance(body.data as SmsWalletBalanceView);
      } catch {
        // Balance is optional UI; keep the settings page usable if lookup fails.
      } finally {
        setRefreshingBalance(false);
      }
    }

    void loadBalance();
  }, [config?.configured, config?.provider, reloadToken]);

  async function handleRefreshBalance() {
    setRefreshingBalance(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/channel-config/sms/balance");
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? dict.failedToLoadBalance);
        return;
      }

      setWalletBalance(body.data as SmsWalletBalanceView);
    } catch {
      setError(dict.failedToLoadBalance);
    } finally {
      setRefreshingBalance(false);
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    setVerifyMessage(null);

    const payload: Record<string, unknown> = {
      provider: form.provider,
      isActive: form.isActive,
    };

    if (form.provider === "CUSTOM_HTTP") {
      payload.username = form.username;
      payload.baseUrl = form.baseUrl;
      payload.sendPath = form.sendPath;
      payload.route = form.route;
      payload.senderId = form.senderId;
      payload.requestTimeoutMs =
        Math.max(1, Number(form.requestTimeoutSeconds) || 30) * 1000;
      payload.successStatusCode = Number(form.successStatusCode) || 1;

      if (form.password.trim()) {
        payload.password = form.password;
      }
    }

    try {
      const response = await fetch("/api/v1/channel-config/sms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? dict.failedToSave);
        return;
      }

      const data = body.data as SmsChannelConfigView;
      setConfig(data);
      setForm((current) => ({
        ...current,
        password: "",
        username: data.username ?? current.username,
        baseUrl: data.baseUrl ?? current.baseUrl,
        sendPath: data.sendPath ?? current.sendPath,
        route: data.route ?? current.route,
        senderId: data.senderId ?? current.senderId,
        requestTimeoutSeconds: String(
          Math.round((data.requestTimeoutMs ?? 30_000) / 1000),
        ),
        successStatusCode: String(data.successStatusCode ?? 1),
      }));
      setSuccess(dict.savedSuccess);
      setReloadToken((current) => current + 1);
    } catch {
      setError(dict.failedToSave);
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setError(null);
    setVerifyMessage(null);

    try {
      const response = await fetch("/api/v1/channel-config/sms/verify", {
        method: "POST",
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? dict.failedToVerify);
        return;
      }

      setVerifyMessage(body.data?.message ?? dict.verifiedDefault);
      if (body.data) {
        setWalletBalance({
          provider: body.data.provider,
          walletBalanceSupported: body.data.walletBalanceSupported,
          balanceCredits: body.data.balanceCredits ?? null,
          message: body.data.message,
        });
      }
    } catch {
      setError(dict.failedToVerify);
    } finally {
      setVerifying(false);
    }
  }

  const isCustomHttp = form.provider === "CUSTOM_HTTP";
  const passwordConfigured = Boolean(
    isCustomHttp && config?.provider === "CUSTOM_HTTP" && config.credentialsConfigured,
  );
  const walletBalanceLabel =
    walletBalance?.balanceCredits === null || walletBalance === null
      ? "-"
      : walletBalance.balanceCredits.toLocaleString();

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <p className="text-sm text-stone-600">{common.loadingConfiguration}</p>
      ) : (
        <>
          <Panel className="p-4 sm:p-5">
            <p className="text-sm font-medium text-stone-800">
              {config?.configured
                ? common.configured
                : config?.usingPlatformDefault
                  ? dict.usingPlatformDefault
                  : common.notConfigured}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {config?.configured
                ? `${common.provider}: ${getCustomerSmsProviderLabel(config.provider)}`
                : config?.usingPlatformDefault
                  ? dict.platformReadyHint
                  : dict.saveOwnGatewayHint}
            </p>
            {config?.configured && config.provider === "CUSTOM_HTTP" ? (
              <p className="mt-1 text-sm text-stone-600">
                {dict.credentials}:{" "}
                {config.credentialsConfigured
                  ? dict.credentialsConfigured
                  : dict.credentialsMissing}
              </p>
            ) : null}
          </Panel>

          {config?.configured ? (
            <Panel className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-800">{dict.walletBalance}</p>
                  <p className="mt-1 text-2xl font-semibold text-stone-900">
                    {walletBalanceLabel}
                    {walletBalance?.walletBalanceSupported ? (
                      <span className="ml-2 text-sm font-normal text-stone-500">
                        {dict.credits}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    {walletBalance?.message ??
                      (config.walletBalanceSupported
                        ? dict.refreshLiveBalance
                        : dict.testProviderNoBalance)}
                  </p>
                </div>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={saving || verifying || refreshingBalance}
                  onClick={() => void handleRefreshBalance()}
                >
                  {refreshingBalance ? dict.refreshing : dict.refresh}
                </button>
              </div>
            </Panel>
          ) : null}

          <Panel className="p-4 sm:p-5">
            <form className="flex flex-col gap-4" onSubmit={handleSave}>
              <div className="block text-sm">
                <span className="font-medium text-stone-800">{dict.gateway}</span>
                <div className="mt-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-stone-700">
                  {getCustomerSmsProviderLabel(form.provider)}
                </div>
              </div>

              <p className="text-sm text-stone-600">
                {dict.enterGatewayDetails(
                  isLocalDemoPrefill ? dict.demoPrefillNote : "",
                )}
              </p>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                />
                <span className="font-medium text-stone-800">{common.active}</span>
              </label>

              {isCustomHttp ? (
                <>
                  <label className="block text-sm">
                    <span className="font-medium text-stone-800">{dict.baseUrl}</span>
                    <input
                      className={`${inputClass} mt-1`}
                      value={form.baseUrl}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, baseUrl: event.target.value }))
                      }
                      placeholder="https://your-provider.example"
                      required
                      autoComplete="off"
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-stone-800">{dict.sendPath}</span>
                    <input
                      className={`${inputClass} mt-1`}
                      value={form.sendPath}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, sendPath: event.target.value }))
                      }
                      placeholder="/send.aspx"
                      required
                      autoComplete="off"
                    />
                    <span className="mt-1 block text-xs text-stone-500">
                      {dict.sendPathHint}
                    </span>
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-stone-800">{dict.username}</span>
                    <input
                      className={`${inputClass} mt-1`}
                      value={form.username}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, username: event.target.value }))
                      }
                      required
                      autoComplete="off"
                    />
                  </label>

                  <MaskedPasswordField
                    configured={passwordConfigured}
                    value={form.password}
                    onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                    required
                    hint={passwordConfigured ? undefined : dict.passwordHint}
                  />

                  <label className="block text-sm">
                    <span className="font-medium text-stone-800">{dict.route}</span>
                    <input
                      className={`${inputClass} mt-1`}
                      value={form.route}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, route: event.target.value }))
                      }
                      placeholder="trans1"
                      required
                    />
                    <span className="mt-1 block text-xs text-stone-500">
                      {dict.routeHint(isLocalDemoPrefill ? dict.routeDemoNote : "")}
                    </span>
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-stone-800">{dict.senderId}</span>
                    <input
                      className={`${inputClass} mt-1`}
                      value={form.senderId}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, senderId: event.target.value }))
                      }
                      required
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="font-medium text-stone-800">
                        {dict.requestTimeout}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        className={`${inputClass} mt-1`}
                        value={form.requestTimeoutSeconds}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            requestTimeoutSeconds: event.target.value,
                          }))
                        }
                        required
                      />
                      <span className="mt-1 block text-xs text-stone-500">
                        {dict.requestTimeoutHint}
                      </span>
                    </label>

                    <label className="block text-sm">
                      <span className="font-medium text-stone-800">{dict.successCode}</span>
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        className={`${inputClass} mt-1`}
                        value={form.successStatusCode}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            successStatusCode: event.target.value,
                          }))
                        }
                        required
                      />
                      <span className="mt-1 block text-xs text-stone-500">
                        {dict.successCodeHint}
                      </span>
                    </label>
                  </div>
                </>
              ) : null}

              {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
              {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}
              {verifyMessage ? <InlineAlert tone="success">{verifyMessage}</InlineAlert> : null}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button type="submit" disabled={saving} className={primaryButtonClass}>
                  {saving ? common.saving : common.saveConfiguration}
                </button>

                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={saving || verifying || !config?.configured}
                  onClick={() => void handleVerify()}
                >
                  {verifying ? dict.verifying : dict.verifyConnection}
                </button>
              </div>
              {!config?.configured ? (
                <p className="text-xs text-stone-500">{dict.saveBeforeVerify}</p>
              ) : null}
            </form>
          </Panel>
        </>
      )}
    </div>
  );
}
