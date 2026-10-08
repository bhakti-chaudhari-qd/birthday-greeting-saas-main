"use client";

import { useState } from "react";

import { InlineAlert, StatusBadge } from "@/components/ui/feedback";
import { secondaryButtonClass } from "@/components/ui/page";
import type {
  MetaWhatsAppHealth,
  PlatformChannelStatus,
} from "@/lib/admin/channel-status";
import { getAdminChannelStatusDict } from "@/lib/i18n/dictionaries/admin-channel-status";
import { useLocale } from "@/lib/i18n/use-locale";

type ChannelStatusPanelProps = {
  organizationId: string;
  channels: PlatformChannelStatus[];
};

/** Per-channel gateway summary, with a live Meta health check for WhatsApp. */
export function ChannelStatusPanel({
  organizationId,
  channels,
}: ChannelStatusPanelProps) {
  const dict = getAdminChannelStatusDict(useLocale());
  const [health, setHealth] = useState<MetaWhatsAppHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkHealth() {
    setChecking(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/admin/organizations/${organizationId}/channel-health`,
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setHealth(null);
        setError(payload?.error?.message ?? dict.failedToCheck);
        return;
      }
      setHealth(payload.data.health as MetaWhatsAppHealth);
    } catch {
      setHealth(null);
      setError(dict.failedToCheck);
    } finally {
      setChecking(false);
    }
  }

  const canSendKey =
    health?.canSendMessage === "AVAILABLE" ||
    health?.canSendMessage === "LIMITED" ||
    health?.canSendMessage === "BLOCKED"
      ? health.canSendMessage
      : null;

  return (
    <div className="space-y-4 p-5 sm:p-6">
      <ul className="divide-y divide-stone-100">
        {channels.map((channel) => (
          <li
            key={channel.channel}
            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-900">
                {dict.channel[channel.channel]}
                {channel.gateway ? (
                  <span className="font-normal text-stone-600"> · {channel.gateway}</span>
                ) : null}
              </p>
              {channel.detail ? (
                <p className="mt-0.5 break-all text-xs text-stone-500">{channel.detail}</p>
              ) : null}
              {channel.source === "own" && !channel.isActive ? (
                <p className="mt-0.5 text-xs text-amber-800">{dict.switchedOff}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge
                label={dict.source[channel.source]}
                tone={
                  channel.source === "none" || !channel.isActive
                    ? "warning"
                    : channel.source === "own"
                      ? "success"
                      : "info"
                }
              />
              {channel.healthCheckSupported ? (
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={checking}
                  onClick={() => void checkHealth()}
                >
                  {checking ? dict.checking : dict.checkHealth}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      {health ? (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-stone-500">{dict.canSend}</dt>
              <dd className="font-semibold text-stone-900">
                {canSendKey ? dict.canSendValue[canSendKey] : (health.canSendMessage ?? "—")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">{dict.number}</dt>
              <dd className="text-stone-900">{health.displayPhoneNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">{dict.numberStatus}</dt>
              <dd className="text-stone-900">{health.numberStatus ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">{dict.displayName}</dt>
              <dd className="text-stone-900">
                {health.verifiedName ?? "—"}
                {health.nameStatus ? ` (${health.nameStatus})` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">{dict.quality}</dt>
              <dd className="text-stone-900">{health.qualityRating ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">{dict.mode}</dt>
              <dd className="text-stone-900">{health.accountMode ?? "—"}</dd>
            </div>
          </dl>

          {health.accountMode === "SANDBOX" ? (
            <p className="mt-3 text-xs text-amber-800">{dict.sandboxNote}</p>
          ) : null}

          {health.issues.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-stone-700">{dict.issuesHeading}</p>
              <ul className="mt-1 space-y-1 text-sm text-red-800">
                {health.issues.map((issue) => (
                  <li key={issue}>• {issue}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-xs text-emerald-800">{dict.noIssues}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
