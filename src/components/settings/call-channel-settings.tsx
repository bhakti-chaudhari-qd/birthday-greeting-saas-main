"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { useOccasions } from "@/components/occasions/use-occasions";
import { CallGatewaySettings } from "@/components/settings/call-gateway-settings";
import { useConfirm } from "@/components/ui/confirm";
import { InlineAlert } from "@/components/ui/feedback";
import {
  Panel,
  compactSecondaryButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import { getCallRecordingsDict } from "@/lib/i18n/dictionaries/call-recordings";
import { translateOccasionName } from "@/lib/i18n/occasion-labels";
import { useLocale } from "@/lib/i18n/use-locale";

type CallMessage = {
  id: string;
  name: string;
  occasionId: string;
  occasionName: string;
  durationSeconds: number;
  audioUrl: string;
  usedByRoutes: number;
};

type DraftAudio = {
  blob: Blob;
  filename: string;
  previewUrl: string;
};

const DEFAULT_MAX_RECORDING_SECONDS = 60;

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

export function CallChannelSettings() {
  const locale = useLocale();
  const dict = getCallRecordingsDict(locale);
  const confirm = useConfirm();
  const { occasions } = useOccasions();

  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [gatewayConfigured, setGatewayConfigured] = useState(true);
  const [maxSeconds, setMaxSeconds] = useState(DEFAULT_MAX_RECORDING_SECONDS);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const [name, setName] = useState("");
  const [occasionId, setOccasionId] = useState("");
  const [draft, setDraft] = useState<DraftAudio | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const draftUrlRef = useRef<string | null>(null);

  const selectedOccasionId = occasionId || occasions[0]?.id || "";

  useEffect(() => {
    async function loadMessages() {
      setLoading(true);

      try {
        const response = await fetch("/api/v1/call-messages");
        const body = await response.json();

        if (!response.ok) {
          setError(body.error?.message ?? dict.failedToLoad);
          return;
        }

        setMessages(body.data as CallMessage[]);
        setGatewayConfigured(Boolean(body.meta?.gatewayConfigured));
        if (typeof body.meta?.maxRecordingSeconds === "number") {
          setMaxSeconds(body.meta.maxRecordingSeconds);
        }
      } catch {
        setError(dict.failedToLoad);
      } finally {
        setLoading(false);
      }
    }

    void loadMessages();
    // dict only changes with the locale; reloading on it would refetch for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  function releaseMicrophone() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  // Leaving the page mid-recording must not keep the microphone open.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (draftUrlRef.current) {
        URL.revokeObjectURL(draftUrlRef.current);
      }
    };
  }, []);

  function replaceDraft(next: { blob: Blob; filename: string } | null) {
    if (draftUrlRef.current) {
      URL.revokeObjectURL(draftUrlRef.current);
      draftUrlRef.current = null;
    }

    if (!next) {
      setDraft(null);
      return;
    }

    const previewUrl = URL.createObjectURL(next.blob);
    draftUrlRef.current = previewUrl;
    setDraft({ ...next, previewUrl });
  }

  async function startRecording() {
    setError(null);
    setSuccess(null);

    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError(dict.recordingUnsupported);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(dict.microphoneBlocked);
      return;
    }

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });
    recorder.addEventListener("stop", () => {
      const mimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(chunks, { type: mimeType });
      releaseMicrophone();
      setRecording(false);
      if (blob.size > 0) {
        replaceDraft({
          blob,
          filename: `recording.${extensionForMimeType(mimeType)}`,
        });
      }
    });

    streamRef.current = stream;
    recorderRef.current = recorder;
    replaceDraft(null);
    setElapsed(0);
    setRecording(true);
    recorder.start();

    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(seconds);
      if (seconds >= maxSeconds && recorder.state === "recording") {
        recorder.stop();
      }
    }, 250);
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  }

  function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setError(null);
    setSuccess(null);
    replaceDraft({ blob: file, filename: file.name });
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError(dict.nameRequired);
      return;
    }
    if (!draft) {
      setError(dict.audioRequired);
      return;
    }

    const form = new FormData();
    form.append("name", name.trim());
    form.append("occasionId", selectedOccasionId);
    form.append("audio", draft.blob, draft.filename);

    setSaving(true);
    try {
      const response = await fetch("/api/v1/call-messages", {
        method: "POST",
        body: form,
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? dict.failedToSave);
        return;
      }

      setName("");
      replaceDraft(null);
      setSuccess(dict.saved);
      setReloadToken((current) => current + 1);
    } catch {
      setError(dict.failedToSave);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(message: CallMessage) {
    if (!(await confirm({ message: dict.confirmDelete(message.name) }))) {
      return;
    }

    setDeletingId(message.id);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/v1/call-messages/${message.id}`, {
        method: "DELETE",
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? dict.failedToDelete);
        return;
      }

      setSuccess(dict.deleted);
      setReloadToken((current) => current + 1);
    } catch {
      setError(dict.failedToDelete);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <Panel className="p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-stone-900">
          {dict.howItWorksHeading}
        </h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-stone-600">
          {dict.howItWorksSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Panel>

      <CallGatewaySettings
        onSaved={() => setReloadToken((current) => current + 1)}
      />

      <Panel className="space-y-5 p-6">
        <div>
          <h2 className="text-base font-semibold text-stone-900">{dict.heading}</h2>
          <p className="mt-1 text-sm text-stone-600">{dict.intro}</p>
        </div>

        {!loading && !gatewayConfigured ? (
          <InlineAlert tone="warning">{dict.gatewayMissing}</InlineAlert>
        ) : null}
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}

        <form className="space-y-4" onSubmit={(event) => void handleSave(event)}>
          <h3 className="text-sm font-semibold text-stone-900">
            {dict.newRecordingHeading}
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-stone-800">{dict.name}</span>
              <input
                className={inputClass}
                value={name}
                maxLength={100}
                placeholder={dict.namePlaceholder}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-stone-800">{dict.occasion}</span>
              <select
                className={inputClass}
                value={selectedOccasionId}
                onChange={(event) => setOccasionId(event.target.value)}
              >
                {occasions.map((occasion) => (
                  <option key={occasion.id} value={occasion.id}>
                    {translateOccasionName(occasion.name, locale)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-stone-800">{dict.message}</p>

            {draft ? (
              <div className="flex flex-wrap items-center gap-3">
                <audio controls src={draft.previewUrl} className="max-w-full" />
                <button
                  type="button"
                  className={compactSecondaryButtonClass}
                  onClick={() => replaceDraft(null)}
                >
                  {dict.recordAgain}
                </button>
              </div>
            ) : recording ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={stopRecording}
                >
                  {dict.stop}
                </button>
                <span className="text-sm text-stone-700" role="status">
                  {dict.recording(formatClock(elapsed), formatClock(maxSeconds))}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => void startRecording()}
                >
                  {dict.record}
                </button>
                <label className={`${secondaryButtonClass} cursor-pointer`}>
                  {dict.uploadInstead}
                  <input
                    type="file"
                    accept="audio/*"
                    className="sr-only"
                    onChange={handleFileChosen}
                  />
                </label>
              </div>
            )}

            <p className="text-xs text-stone-500">{dict.limitNote(maxSeconds)}</p>
          </div>

          <button
            type="submit"
            className={primaryButtonClass}
            disabled={saving || recording || !selectedOccasionId}
          >
            {saving ? dict.saving : dict.save}
          </button>
        </form>
      </Panel>

      <Panel className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-stone-900">
            {dict.listHeading}
          </h2>
          <Link
            href="/dashboard/settings/greeting-routes"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            {dict.setUpRoutes}
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-stone-600">{dict.loading}</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-stone-600">{dict.empty}</p>
        ) : (
          <ul className="divide-y divide-stone-200 border-y border-stone-200">
            {messages.map((message) => (
              <li
                key={message.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900">
                    {message.name}
                  </p>
                  <p className="mt-0.5 text-sm text-stone-600">
                    {translateOccasionName(message.occasionName, locale)} ·{" "}
                    {dict.seconds(message.durationSeconds)}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {message.usedByRoutes > 0
                      ? dict.usedByRoutes(message.usedByRoutes)
                      : dict.notUsed}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <audio
                    controls
                    preload="none"
                    src={message.audioUrl}
                    className="max-w-full"
                  />
                  <button
                    type="button"
                    className={compactSecondaryButtonClass}
                    disabled={deletingId === message.id}
                    onClick={() => void handleDelete(message)}
                  >
                    {dict.delete}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
