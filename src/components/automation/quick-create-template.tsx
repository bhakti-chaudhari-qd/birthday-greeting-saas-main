"use client";

import { useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass } from "@/components/ui/page";

export type AutomationTemplateType = "BIRTHDAY" | "ANNIVERSARY" | "CUSTOM";
export type AutomationTemplateChannel = "SMS" | "WHATSAPP";

export type QuickCreatedTemplate = {
  id: string;
  name: string;
  realSmsReady: boolean;
  realSmsStatusLabel: string;
};

type QuickCreateTemplateProps = {
  occasionLabel: string;
  type: AutomationTemplateType;
  channel: AutomationTemplateChannel;
  onCreated: (template: QuickCreatedTemplate) => void;
};

function defaultMessage(type: AutomationTemplateType) {
  if (type === "BIRTHDAY") {
    return "Happy Birthday {{name}}! Wishing you a wonderful year ahead.";
  }
  if (type === "ANNIVERSARY") {
    return "Happy Anniversary {{name}}! Wishing you a wonderful day.";
  }
  return "Best wishes, {{name}}!";
}

export function QuickCreateTemplate({
  occasionLabel,
  type,
  channel,
  onCreated,
}: QuickCreateTemplateProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${occasionLabel} ${channel}`);
  const [message, setMessage] = useState(defaultMessage(type));
  const [providerTemplateName, setProviderTemplateName] = useState("");
  const [language, setLanguage] = useState("en");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  async function handleSuggestAi() {
    setAiLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/ai/suggest-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasionType: type,
          channel,
          tone: "warm",
          existingBody: message || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? "Could not suggest a message");
        return;
      }
      if (typeof body.data?.body === "string" && body.data.body.trim()) {
        setMessage(body.data.body);
      }
    } catch {
      setError("Could not suggest a message");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleCreate() {
    if (!name.trim() || !message.trim()) {
      setError("Name and message are required");
      return;
    }
    if (channel === "WHATSAPP" && (!providerTemplateName.trim() || !language.trim())) {
      setError("Provider template name and language are required");
      return;
    }

    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name,
      type,
      channel,
      body: message,
      isActive: true,
    };

    if (channel === "WHATSAPP") {
      payload.whatsappTemplateName = providerTemplateName;
      payload.whatsappLanguage = language;
    }

    try {
      const response = await fetch("/api/v1/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? "Could not create this message");
        return;
      }

      onCreated({
        id: body.data.id,
        name: body.data.name,
        realSmsReady: body.data.realSmsReady ?? false,
        realSmsStatusLabel:
          body.data.realSmsStatusLabel ??
          (channel === "WHATSAPP" ? "WhatsApp ready" : "Available for Test"),
      });
      setOpen(false);
    } catch {
      setError("Could not create this message");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-sm font-medium text-primary underline"
        onClick={() => setOpen(true)}
      >
        Create a {channel === "SMS" ? "text message" : "WhatsApp message"}
      </button>
    );
  }

  // Use a div (not form) - this UI is rendered inside the settings <form>.
  return (
    <div
      className="space-y-3 rounded-lg border border-stone-200 bg-white p-4"
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        const target = event.target as HTMLElement;
        if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
        event.preventDefault();
        void handleCreate();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-900">
            New {occasionLabel} {channel} message
          </p>
          <p className="mt-1 text-xs text-stone-600">
            Type, channel, and Active are set automatically.
          </p>
        </div>
        <button
          type="button"
          className="text-sm text-stone-600 underline"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </button>
      </div>

      <label className="block text-sm">
        <span className="font-medium text-stone-800">Name</span>
        <input
          className={`${inputClass} mt-1`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>

      {channel === "WHATSAPP" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-stone-800">
              Provider template name
            </span>
            <input
              className={`${inputClass} mt-1`}
              value={providerTemplateName}
              onChange={(event) => setProviderTemplateName(event.target.value)}
              placeholder="Exact name from your provider"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">Language</span>
            <input
              className={`${inputClass} mt-1`}
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              placeholder="en"
              required
            />
          </label>
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="font-medium text-stone-800">
          {channel === "WHATSAPP"
            ? "Preview text (not sent in Live mode)"
            : "Message"}
        </span>
        <textarea
          className={`${inputClass} mt-1 min-h-24`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
        />
        <button
          type="button"
          disabled={aiLoading || saving}
          onClick={() => void handleSuggestAi()}
          className="mt-2 text-xs font-medium text-primary underline disabled:opacity-60"
        >
          {aiLoading ? "Generating…" : "Suggest with AI"}
        </button>
      </label>

      {channel === "WHATSAPP" ? (
        <p className="text-xs text-stone-600">
          Live WhatsApp sends the provider-approved message attached to the
          template name above.
        </p>
      ) : (
        <p className="text-xs text-stone-600">
          Ready for Practice mode. Live SMS may also require DLT setup.
        </p>
      )}

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <button
        type="button"
        disabled={saving}
        className={primaryButtonClass}
        onClick={() => void handleCreate()}
      >
        {saving ? "Creating…" : "Create and select"}
      </button>
    </div>
  );
}
