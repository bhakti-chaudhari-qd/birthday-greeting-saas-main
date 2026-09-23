"use client";

import { useEffect, useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/page";

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
        setError(body.error?.message ?? "Failed to save setting");
        return;
      }

      setSetting(body.data as SettingState);
    } catch {
      setError("Failed to save setting");
    } finally {
      setSaving(false);
    }
  }

  if (!visible || !setting) {
    return null;
  }

  return (
    <Panel className="p-5">
      <h2 className="text-sm font-semibold text-stone-900">
        Staff visibility for admin-added contacts
      </h2>
      <p className="mt-1 text-sm text-stone-600">
        When our platform admin adds or imports contacts into your account
        on your behalf, their mobile number and email are hidden from Staff
        users by default. Turning this on lets Staff see those details in
        full. This never affects what you (Owner) can see, and doesn&rsquo;t
        change anything for contacts your team added themselves.
      </p>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={setting.staffCanViewContactDetails}
          disabled={saving || !setting.adminAllowed}
          onChange={(event) => void handleToggle(event.target.checked)}
        />
        <span className="font-medium text-stone-800">
          Staff can view full details of contacts admin added for us
        </span>
      </label>

      {!setting.adminAllowed ? (
        <p className="mt-2 text-xs text-stone-500">
          Our platform has restricted this for your account, so it stays
          hidden from Staff regardless of this setting. Contact support if
          you have questions.
        </p>
      ) : null}

      {error ? (
        <div className="mt-3">
          <InlineAlert tone="error">{error}</InlineAlert>
        </div>
      ) : null}
    </Panel>
  );
}
