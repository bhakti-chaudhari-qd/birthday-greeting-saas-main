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
          setError(body.error?.message ?? "Failed to load SMS channel configuration");
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
        setError("Failed to load SMS channel configuration");
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
        setError(body.error?.message ?? "Failed to load SMS wallet balance");
        return;
      }

      setWalletBalance(body.data as SmsWalletBalanceView);
    } catch {
      setError("Failed to load SMS wallet balance");
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
        setError(body.error?.message ?? "Failed to save SMS channel configuration");
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
      setSuccess("Configuration saved successfully.");
      setReloadToken((current) => current + 1);
    } catch {
      setError("Failed to save SMS channel configuration");
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
        setError(body.error?.message ?? "Failed to verify SMS channel configuration");
        return;
      }

      setVerifyMessage(body.data?.message ?? "Configuration verified");
      if (body.data) {
        setWalletBalance({
          provider: body.data.provider,
          walletBalanceSupported: body.data.walletBalanceSupported,
          balanceCredits: body.data.balanceCredits ?? null,
          message: body.data.message,
        });
      }
    } catch {
      setError("Failed to verify SMS channel configuration");
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
        <p className="text-sm text-stone-600">Loading configuration…</p>
      ) : (
        <>
          <Panel className="p-4 sm:p-5">
            <p className="text-sm font-medium text-stone-800">
              {config?.configured ? "Configured" : "Not configured"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {config?.configured
                ? `Provider: ${getCustomerSmsProviderLabel(config.provider)}`
                : "Save a configuration to enable SMS."}
            </p>
            {config?.configured && config.provider === "CUSTOM_HTTP" ? (
              <p className="mt-1 text-sm text-stone-600">
                Credentials:{" "}
                {config.credentialsConfigured ? "configured" : "missing or invalid"}
              </p>
            ) : null}
          </Panel>

          {config?.configured ? (
            <Panel className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-800">SMS wallet balance</p>
                  <p className="mt-1 text-2xl font-semibold text-stone-900">
                    {walletBalanceLabel}
                    {walletBalance?.walletBalanceSupported ? (
                      <span className="ml-2 text-sm font-normal text-stone-500">credits</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    {walletBalance?.message ??
                      (config.walletBalanceSupported
                        ? "Refresh to load your live SMS gateway balance."
                        : "Test provider has no live wallet balance.")}
                  </p>
                </div>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={saving || verifying || refreshingBalance}
                  onClick={() => void handleRefreshBalance()}
                >
                  {refreshingBalance ? "Refreshing…" : "Refresh balance"}
                </button>
              </div>
            </Panel>
          ) : null}

          <Panel className="p-4 sm:p-5">
            <form className="flex flex-col gap-4" onSubmit={handleSave}>
              <div className="block text-sm">
                <span className="font-medium text-stone-800">SMS gateway</span>
                <div className="mt-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-stone-700">
                  {getCustomerSmsProviderLabel(form.provider)}
                </div>
              </div>

              <p className="text-sm text-stone-600">
                {`Enter your SMS gateway details.${isLocalDemoPrefill ? " Empty fields are prefilled locally for testing." : ""}`}
              </p>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                />
                <span className="font-medium text-stone-800">Active</span>
              </label>

              {isCustomHttp ? (
                <>
                  <label className="block text-sm">
                    <span className="font-medium text-stone-800">Base URL</span>
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
                    <span className="font-medium text-stone-800">Send path</span>
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
                      Must start with <code className="rounded bg-stone-100 px-1">/</code>.
                    </span>
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-stone-800">Username</span>
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
                    hint={
                      passwordConfigured
                        ? undefined
                        : "Required the first time you set up Custom HTTP."
                    }
                  />

                  <label className="block text-sm">
                    <span className="font-medium text-stone-800">Route</span>
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
                      Exact route code from your SMS provider
                      {isLocalDemoPrefill ? (
                        <>
                          {" "}
                          (local demo:{" "}
                          <code className="rounded bg-stone-100 px-1">trans1</code>)
                        </>
                      ) : null}
                      .
                    </span>
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-stone-800">Sender ID</span>
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
                      <span className="font-medium text-stone-800">Request timeout</span>
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
                        Seconds to wait for the SMS provider response.
                      </span>
                    </label>

                    <label className="block text-sm">
                      <span className="font-medium text-stone-800">Success code</span>
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
                        First value in a successful provider response.
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
                  {saving ? "Saving…" : "Save Configuration"}
                </button>

                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={saving || verifying || !config?.configured}
                  onClick={() => void handleVerify()}
                >
                  {verifying ? "Verifying…" : "Verify Connection"}
                </button>
              </div>
              {!config?.configured ? (
                <p className="text-xs text-stone-500">
                  Save a configuration before verifying the connection.
                </p>
              ) : null}
            </form>
          </Panel>
        </>
      )}
    </div>
  );
}
