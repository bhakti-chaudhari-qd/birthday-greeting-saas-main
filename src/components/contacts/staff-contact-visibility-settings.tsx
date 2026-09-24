"use client";

import { useEffect, useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/page";
import { getContactsDict } from "@/lib/i18n/dictionaries/contacts";
import { useLocale } from "@/lib/i18n/use-locale";

type SettingState = {
  staffCanViewContactDetails: boolean;
  adminAllowed: boolean;
};

/**
 * Owner-only control: whether Staff users can see the real mobile/email of
 * a contact a Platform Admin added on this client's behalf (masked by
 * default). Silently renders nothing for Staff/no-org viewers - the GET
 * below 403s for them, which this treats as "not applicable" rather than
 * an error worth surfacing.
 */
export function StaffContactVisibilitySettings() {
  const dict = getContactsDict(useLocale()).staffVisibility;
  const [setting, setSetting] = useState<SettingState | null>(null);
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/v1/settings/staff-contact-visibility");
        if (!response.ok) {
          return;
        }
        const body = await response.json();
        setSetting(body.data as SettingState);
        setVisible(true);
      } catch {
        // Not shown - this control is optional and Owner-only.
      }
    }

    void load();
  }, []);

  async function handleToggle(next: boolean) {
    if (!setting) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/settings/staff-contact-visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffCanViewContactDetails: next }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? dict.failedToSave);
        return;
      }

      setSetting(body.data as SettingState);
    } catch {
      setError(dict.failedToSave);
    } finally {
      setSaving(false);
    }
  }

  if (!visible || !setting) {
    return null;
  }

  return (
    <Panel className="p-5">
      <h2 className="text-sm font-semibold text-stone-900">{dict.title}</h2>
      <p className="mt-1 text-sm text-stone-600">{dict.description}</p>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={setting.staffCanViewContactDetails}
          disabled={saving || !setting.adminAllowed}
          onChange={(event) => void handleToggle(event.target.checked)}
        />
        <span className="font-medium text-stone-800">{dict.toggleLabel}</span>
      </label>

      {!setting.adminAllowed ? (
        <p className="mt-2 text-xs text-stone-500">{dict.adminRestrictedNote}</p>
      ) : null}

      {error ? (
        <div className="mt-3">
          <InlineAlert tone="error">{error}</InlineAlert>
        </div>
      ) : null}
    </Panel>
  );
}
