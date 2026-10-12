"use client";

import { useEffect, useState } from "react";

import { MaskedPasswordField } from "@/components/settings/masked-password-field";
import { InlineAlert } from "@/components/ui/feedback";
import { Panel, inputClass, primaryButtonClass } from "@/components/ui/page";
import { getCallRecordingsDict } from "@/lib/i18n/dictionaries/call-recordings";
import { getChannelSettingsDict } from "@/lib/i18n/dictionaries/channel-settings";
import { useLocale } from "@/lib/i18n/use-locale";

type CallChannelConfigView = {
  configured: boolean;
  isActive: boolean;
  credentialsConfigured: boolean;
  baseUrl: string;
  sendPath: string;
  username: string;
  route: string;
  callerId: string;
};

type FormState = {
  isActive: boolean;
  baseUrl: string;
  sendPath: string;
  username: string;
  password: string;
  route: string;
  callerId: string;
};

const emptyForm: FormState = {
  isActive: true,
  baseUrl: "",
  sendPath: "/SendVoice.aspx",
  username: "",
  password: "",
  route: "",
  callerId: "",
};

/** The client's own voice gateway account, the same way SMS is set up. */
export function CallGatewaySettings({
  onSaved,
}: {
  /** Lets the recordings list refresh its "calls are not set up" notice. */
  onSaved?: () => void;
}) {
  const locale = useLocale();
  const channelDict = getChannelSettingsDict(locale);
  const common = channelDict.common;
  const sms = channelDict.sms;
  const dict = getCallRecordingsDict(locale).gateway;
  const [config, setConfig] = useState<CallChannelConfigView | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);

      try {
        const response = await fetch("/api/v1/channel-config/call");
        const body = await response.json();

        if (!response.ok) {
          setError(body.error?.message ?? dict.failedToLoad);
          return;
        }

        const data = body.data as CallChannelConfigView;
        setConfig(data);
        setForm({
          isActive: data.configured ? data.isActive : true,
          baseUrl: data.baseUrl,
          sendPath: data.sendPath,
          username: data.username,
          password: "",
          route: data.route,
          callerId: data.callerId,
        });
      } catch {
        setError(dict.failedToLoad);
      } finally {
        setLoading(false);
      }
    }

    void loadConfig();
    // dict only changes with the locale; reloading on it would refetch for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/v1/channel-config/call", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: form.isActive,
          baseUrl: form.baseUrl.trim(),
          sendPath: form.sendPath.trim(),
          username: form.username.trim(),
          ...(form.password ? { password: form.password } : {}),
          route: form.route.trim(),
          callerId: form.callerId.trim(),
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? dict.failedToSave);
        return;
      }

      setSuccess(dict.savedSuccess);
      setReloadToken((current) => current + 1);
      onSaved?.();
    } catch {
      setError(dict.failedToSave);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !config) {
    return <p className="text-sm text-stone-600">{common.loadingConfiguration}</p>;
  }

  return (
    <Panel className="p-4 sm:p-5">
      <form className="flex flex-col gap-4" onSubmit={handleSave}>
        <div>
          <h2 className="text-base font-semibold text-stone-900">{dict.heading}</h2>
          <p className="mt-1 text-sm text-stone-600">{dict.intro}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{sms.baseUrl}</span>
            <input
              className={`${inputClass} mt-1`}
              value={form.baseUrl}
              onChange={(event) => setField("baseUrl", event.target.value)}
              placeholder="http://your-voice-gateway.example"
              autoComplete="off"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{sms.sendPath}</span>
            <input
              className={`${inputClass} mt-1`}
              value={form.sendPath}
              onChange={(event) => setField("sendPath", event.target.value)}
              placeholder="/SendVoice.aspx"
              autoComplete="off"
              required
            />
            <span className="mt-1 block text-xs text-stone-500">
              {sms.sendPathHint}
            </span>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-stone-800">{sms.username}</span>
            <input
              className={`${inputClass} mt-1`}
              value={form.username}
              onChange={(event) => setField("username", event.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <MaskedPasswordField
            configured={Boolean(config?.credentialsConfigured)}
            value={form.password}
            onChange={(value) => setField("password", value)}
            required
          />

          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.route}</span>
            <input
              className={`${inputClass} mt-1`}
              value={form.route}
              onChange={(event) => setField("route", event.target.value)}
              autoComplete="off"
              required
            />
            <span className="mt-1 block text-xs text-stone-500">{dict.routeHint}</span>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.callerId}</span>
            <input
              className={`${inputClass} mt-1`}
              value={form.callerId}
              onChange={(event) => setField("callerId", event.target.value)}
              autoComplete="off"
              required
            />
            <span className="mt-1 block text-xs text-stone-500">
              {dict.callerIdHint}
            </span>
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-stone-800">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => setField("isActive", event.target.checked)}
          />
          {common.active}
        </label>

        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
          <p className="font-medium text-stone-800">{common.currentStatus}</p>
          <p className="mt-1">
            {config?.configured
              ? `${common.configured} · ${
                  config.isActive ? common.activeWord : common.inactiveWord
                }`
              : dict.notConfigured}
          </p>
        </div>

        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? common.saving : common.saveConfiguration}
          </button>
        </div>
      </form>
    </Panel>
  );
}
