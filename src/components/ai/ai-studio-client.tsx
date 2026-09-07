"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { generateGreetingImage } from "@/components/ai/generate-greeting-image";
import {
  blobToBase64,
  recordGreetingVideo,
} from "@/components/ai/generate-greeting-video";
import { WhatsAppPreview } from "@/components/ai/whatsapp-preview";
import { useOccasions } from "@/components/occasions/use-occasions";
import { InlineAlert } from "@/components/ui/feedback";
import { fetchOrganizationCategories } from "@/lib/client/organization-reference-data";
import {
  PageHeader,
  PageShell,
  Panel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";

const compactPrimaryButtonClass =
  "inline-flex w-full items-center justify-center rounded-full bg-primary px-2.5 py-1.5 text-center text-xs font-medium leading-snug text-white outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";

const compactMediaButtonClass =
  "inline-flex w-full items-center justify-center rounded-full border border-stone-300 bg-white px-2.5 py-1.5 text-center text-xs font-medium leading-snug text-stone-800 outline-none transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";
import {
  WHATSAPP_MEDIA_MAX_BYTES,
  type WhatsAppMediaContentType,
} from "@/lib/channel-config/whatsapp-types";
import {
  EMPTY_IMAGE_OVERLAY,
  hasImageOverlay,
  revokeOverlayUrls,
  WhatsAppImageOverlayControls,
  WhatsAppImageOverlayPreview,
  type ImageOverlayState,
} from "@/components/messages/whatsapp-image-overlay-controls";
import { templateNameForOccasionMedia } from "@/lib/templates/whatsapp-template-name";

type Channel = "SMS" | "WHATSAPP";
type ContactCategoryOption = { id: string; name: string };
const PREVIEW_NAME_PLACEHOLDER = "Name";

function previewBody(body: string, sampleName: string) {
  return body.replace(/\{\{name\}\}/g, sampleName);
}

function whatsappProviderTemplateName(occasionName: string): string {
  const slug = occasionName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `test_${slug || "occasion"}_greeting`;
}

function isAllowedVideoUpload(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    type === "video/mp4" ||
    type === "video/webm" ||
    name.endsWith(".mp4") ||
    name.endsWith(".webm")
  );
}

function isAllowedImageUpload(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    type === "image/jpeg" || name.endsWith(".jpg") || name.endsWith(".jpeg")
  );
}

function contentTypeForVideoFile(file: File): "video/mp4" | "video/webm" {
  const name = file.name.toLowerCase();
  if (file.type === "video/webm" || name.endsWith(".webm")) {
    return "video/webm";
  }
  return "video/mp4";
}

function revokeMediaPreviewUrl(url: string | null) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

export function AiStudioClient() {
  const { occasions } = useOccasions();
  const [occasionId, setOccasionId] = useState("");
  const occasionName =
    occasions.find((occasion) => occasion.id === occasionId)?.name ??
    occasions[0]?.name ??
    "Birthday";
  const [channel, setChannel] = useState<Channel>("SMS");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<ContactCategoryOption[]>([]);
  const [body, setBody] = useState("");
  const [previewName, setPreviewName] = useState(PREVIEW_NAME_PLACEHOLDER);
  const [lengthHint, setLengthHint] = useState<string | null>(null);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveTemplatesHref, setSaveTemplatesHref] = useState<string | null>(
    null,
  );

  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [mediaFilename, setMediaFilename] = useState<string | null>(null);
  const [mediaContentType, setMediaContentType] =
    useState<WhatsAppMediaContentType | null>(null);
  const [mediaBytes, setMediaBytes] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [overlay, setOverlay] = useState<ImageOverlayState>(EMPTY_IMAGE_OVERLAY);
  const videoUploadInputRef = useRef<HTMLInputElement>(null);
  const imageUploadInputRef = useRef<HTMLInputElement>(null);

  const isImageMedia = mediaContentType === "image/jpeg";
  const isVideoMedia =
    mediaContentType === "video/mp4" || mediaContentType === "video/webm";
  const showOverlayPreview =
    isImageMedia && Boolean(mediaPreviewUrl) && hasImageOverlay(overlay);

  const smsPreview = useMemo(
    () => previewBody(body, previewName.trim() || PREVIEW_NAME_PLACEHOLDER),
    [body, previewName],
  );
  const busy = loading || saving;

  useEffect(() => {
    function selectDefaultOccasion() {
      setOccasionId((current) => {
        if (current && occasions.some((occasion) => occasion.id === current)) {
          return current;
        }
        return occasions[0]?.id ?? "";
      });
    }
    if (occasions.length > 0) {
      selectDefaultOccasion();
    }
  }, [occasions]);

  useEffect(() => {
    let cancelled = false;
    async function loadCategories() {
      try {
        const categories = await fetchOrganizationCategories();
        if (cancelled) {
          return;
        }
        setCategories(categories);
      } catch {
        // Optional - All groups still works.
      }
    }
    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) {
        URL.revokeObjectURL(mediaPreviewUrl);
      }
      revokeOverlayUrls(overlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaPreviewUrl]);

  function clearOverlay() {
    revokeOverlayUrls(overlay);
    setOverlay(EMPTY_IMAGE_OVERLAY);
  }

  function clearMedia() {
    revokeMediaPreviewUrl(mediaPreviewUrl);
    clearOverlay();
    setMediaPreviewUrl(null);
    setMediaBlob(null);
    setMediaFilename(null);
    setMediaContentType(null);
    setMediaBytes(null);
  }

  function handleChannelChange(next: Channel) {
    setChannel(next);
    setError(null);
    setSaveSuccess(null);
    setSaveTemplatesHref(null);
    if (next === "SMS") {
      clearMedia();
    }
  }

  function draftFromSuggestPayload(payload: {
    data?: {
      body?: string;
      variants?: string[];
      lengthHint?: string | null;
      lengthHints?: Array<string | null>;
      provider?: string;
    };
  }) {
    const bodyText =
      (typeof payload.data?.body === "string" && payload.data.body.trim()
        ? payload.data.body
        : null) ??
      payload.data?.variants?.find((variant) => variant.trim()) ??
      null;
    if (!bodyText) {
      return null;
    }

    return {
      body: bodyText,
      lengthHint:
        payload.data?.lengthHint ?? payload.data?.lengthHints?.[0] ?? null,
      providerLabel:
        payload.data?.provider === "openai" ? "smart draft" : "draft library",
    };
  }

  async function applySuggestPayload(payload: {
    data?: {
      body?: string;
      variants?: string[];
      lengthHint?: string | null;
      lengthHints?: Array<string | null>;
      provider?: string;
    };
  }) {
    const draft = draftFromSuggestPayload(payload);
    if (!draft) {
      return false;
    }

    setBody(draft.body);
    setLengthHint(draft.lengthHint);
    setProviderLabel(draft.providerLabel);
    return true;
  }

  async function suggestMessageForChannel(suggestChannel: Channel) {
    const response = await fetch("/api/v1/ai/suggest-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        occasionName,
        channel: suggestChannel,
        tone: "warm",
        variantCount: 1,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Could not generate a message");
    }
    return applySuggestPayload(payload);
  }

  async function handleSuggestDraft() {
    setLoading(true);
    setError(null);
    setSaveSuccess(null);
    setSaveTemplatesHref(null);

    try {
      const applied = await suggestMessageForChannel(channel);
      if (!applied) {
        setError("Could not generate a draft");
      }
    } catch {
      setError("Could not generate a draft");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateImage() {
    setLoading(true);
    setError(null);

    try {
      revokeMediaPreviewUrl(mediaPreviewUrl);
      clearOverlay();

      const result = await generateGreetingImage({
        occasionName,
        recipientName: previewName.trim() || PREVIEW_NAME_PLACEHOLDER,
      });

      if (result.byteLength > WHATSAPP_MEDIA_MAX_BYTES) {
        URL.revokeObjectURL(result.previewUrl);
        setError(
          `Image is too large (${Math.round(result.byteLength / 1000)} KB). Try again or upload a smaller file.`,
        );
        return;
      }

      setMediaPreviewUrl(result.previewUrl);
      setMediaBlob(result.blob);
      setMediaFilename(result.filename);
      setMediaContentType(result.contentType);
      setMediaBytes(result.byteLength);

      if (!body.trim()) {
        try {
          await suggestMessageForChannel("WHATSAPP");
        } catch {
          // Image is ready; message can be added manually.
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate the image",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateVideo() {
    setLoading(true);
    setError(null);

    try {
      revokeMediaPreviewUrl(mediaPreviewUrl);
      clearOverlay();

      const result = await recordGreetingVideo({
        occasionName,
        recipientName: previewName.trim() || PREVIEW_NAME_PLACEHOLDER,
      });

      if (result.byteLength > WHATSAPP_MEDIA_MAX_BYTES) {
        URL.revokeObjectURL(result.previewUrl);
        setError(
          `Video is too large (${Math.round(result.byteLength / 1000)} KB). Try again or upload a smaller file.`,
        );
        return;
      }

      setMediaPreviewUrl(result.previewUrl);
      setMediaBlob(result.blob);
      setMediaFilename(result.filename);
      setMediaContentType(result.contentType);
      setMediaBytes(result.byteLength);

      if (!body.trim()) {
        try {
          await suggestMessageForChannel("WHATSAPP");
        } catch {
          // Video is ready; message can be added manually.
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate the video",
      );
    } finally {
      setLoading(false);
    }
  }

  async function applyUploadedMedia(
    file: File,
    contentType: WhatsAppMediaContentType,
  ) {
    setError(null);
    setLoading(true);

    try {
      const previewUrl = URL.createObjectURL(file);

      revokeMediaPreviewUrl(mediaPreviewUrl);
      if (contentType !== "image/jpeg") {
        clearOverlay();
      }
      setMediaPreviewUrl(previewUrl);
      setMediaBlob(file);
      setMediaFilename(file.name);
      setMediaContentType(contentType);
      setMediaBytes(file.size);

      if (!body.trim()) {
        try {
          await suggestMessageForChannel("WHATSAPP");
        } catch {
          // Media is ready; message can be added manually.
        }
      }
    } catch {
      setError("Could not read that media file");
    } finally {
      setLoading(false);
    }
  }

  async function handleVideoUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!isAllowedVideoUpload(file)) {
      setError("Upload an MP4 or WebM video");
      return;
    }

    if (file.size > WHATSAPP_MEDIA_MAX_BYTES) {
      setError(
        `Video must be at most ${Math.floor(WHATSAPP_MEDIA_MAX_BYTES / 1000)} KB`,
      );
      return;
    }

    await applyUploadedMedia(file, contentTypeForVideoFile(file));
  }

  async function handleImageUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!isAllowedImageUpload(file)) {
      setError("Upload a JPEG image");
      return;
    }

    if (file.size > WHATSAPP_MEDIA_MAX_BYTES) {
      setError(
        `Image must be at most ${Math.floor(WHATSAPP_MEDIA_MAX_BYTES / 1000)} KB`,
      );
      return;
    }

    await applyUploadedMedia(file, "image/jpeg");
  }

  async function handleMediaDrop(file: File | undefined) {
    if (!file) {
      return;
    }
    if (isAllowedImageUpload(file)) {
      await handleImageUpload(file);
      return;
    }
    if (isAllowedVideoUpload(file)) {
      await handleVideoUpload(file);
      return;
    }
    setError("Upload a JPEG image or an MP4/WebM video");
  }

  async function uploadWhatsAppMedia(): Promise<string | undefined> {
    if (
      channel !== "WHATSAPP" ||
      !mediaBlob ||
      !mediaFilename ||
      !mediaContentType
    ) {
      return undefined;
    }

    const mediaBase64 = await blobToBase64(mediaBlob);

    if (isImageMedia && hasImageOverlay(overlay)) {
      const composeResponse = await fetch("/api/v1/whatsapp-media/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseImageBase64: mediaBase64,
          footerImageBase64: overlay.footerImageBase64,
          filename: `${mediaFilename.replace(/\.jpe?g$/i, "")}-branded.jpg`,
        }),
      });
      const composePayload = await composeResponse.json();
      if (!composeResponse.ok) {
        throw new Error(
          composePayload.error?.message ?? "Could not compose WhatsApp image",
        );
      }
      return composePayload.data.id as string;
    }

    const mediaResponse = await fetch("/api/v1/whatsapp-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaBase64,
        filename: mediaFilename,
        contentType: mediaContentType,
      }),
    });
    const mediaPayload = await mediaResponse.json();
    if (!mediaResponse.ok) {
      throw new Error(
        mediaPayload.error?.message ?? "Could not upload WhatsApp media",
      );
    }
    return mediaPayload.data.id as string;
  }

  async function handleSaveTemplate() {
    if (!body.trim()) {
      setError("Add a message before saving a template");
      return;
    }
    if (!occasionId) {
      setError("Choose an occasion before saving a template");
      return;
    }

    setSaving(true);
    setError(null);
    setSaveSuccess(null);
    setSaveTemplatesHref(null);

    const attachedMediaType =
      channel === "WHATSAPP" ? mediaContentType : null;
    const templateName = templateNameForOccasionMedia(
      occasionName,
      attachedMediaType,
    );
    const categoryName =
      categoryId === ""
        ? "All groups"
        : (categories.find((category) => category.id === categoryId)?.name ??
          "selected category");

    try {
      const whatsappMediaAssetId =
        channel === "WHATSAPP" ? await uploadWhatsAppMedia() : undefined;

      const payload: Record<string, unknown> = {
        name: templateName,
        occasionId,
        channel,
        body,
        categoryId: categoryId || null,
        isActive: true,
        replaceExisting: true,
      };

      if (channel === "WHATSAPP") {
        payload.whatsappProviderTemplateId = `test_${occasionId}_id`;
        payload.whatsappTemplateName =
          whatsappProviderTemplateName(occasionName);
        payload.whatsappLanguage = "en";
        if (whatsappMediaAssetId) {
          payload.whatsappMediaAssetId = whatsappMediaAssetId;
        }
      }

      const response = await fetch("/api/v1/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message ?? "Could not save template");
        return;
      }

      const savedName = result.data?.name ?? templateName;
      const templatesHref = `/dashboard/templates?channel=${channel}&occasionId=${occasionId}`;
      setSaveSuccess(
        `Saved “${savedName}” for ${categoryName}. Open Templates to see the ${occasionName} tag.`,
      );
      setSaveTemplatesHref(templatesHref);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not save template",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <PageHeader title="AI writing tools" />

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {saveSuccess ? (
        <InlineAlert tone="success">
          {saveSuccess}
          {saveTemplatesHref ? (
            <>
              {" "}
              <a
                href={saveTemplatesHref}
                className="font-medium text-emerald-900 underline underline-offset-2"
              >
                View template card
              </a>
            </>
          ) : null}
        </InlineAlert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <Panel className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm">
              <span className="font-medium text-stone-800">Occasion</span>
              <select
                className={`${inputClass} mt-1`}
                value={occasionId}
                onChange={(event) => setOccasionId(event.target.value)}
              >
                {occasions.map((occasion) => (
                  <option key={occasion.id} value={occasion.id}>
                    {occasion.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-stone-800">Channel</span>
              <select
                className={`${inputClass} mt-1`}
                value={channel}
                onChange={(event) =>
                  handleChannelChange(event.target.value as Channel)
                }
              >
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-stone-800">Category</span>
              <select
                className={`${inputClass} mt-1`}
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">All groups</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-stone-800">
                Preview as (name)
              </span>
              <input
                className={`${inputClass} mt-1`}
                value={previewName}
                onChange={(event) => setPreviewName(event.target.value)}
                placeholder={PREVIEW_NAME_PLACEHOLDER}
                maxLength={60}
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-stone-800">
              {channel === "WHATSAPP" ? "WhatsApp message" : "Message"}
            </span>
            <textarea
              className={`${inputClass} mt-1 min-h-28`}
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setLengthHint(null);
              }}
              placeholder="Generate a draft, or type your own with {{name}}"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSuggestDraft()}
              className={secondaryButtonClass}
            >
              {loading ? "Generating…" : "Suggest a draft"}
            </button>
          </div>

          {lengthHint ? (
            <p className="text-xs text-amber-800">{lengthHint}</p>
          ) : null}
          {providerLabel ? (
            <p className="text-xs text-stone-500">
              Last update from {providerLabel}. Edit freely before you save.
            </p>
          ) : null}

          {channel === "WHATSAPP" ? (
            <div className="border-t border-stone-200 pt-4">
              <p className="text-sm font-medium text-stone-800">Media</p>
              <p className="mt-1 text-xs text-stone-500">
                Optional. One JPEG image or one video (MP4/WebM). Max{" "}
                {Math.floor(WHATSAPP_MEDIA_MAX_BYTES / 1000)} KB.
              </p>

              <div
                className={[
                  "mt-3 grid grid-cols-4 gap-1.5",
                  dragActive
                    ? "rounded-lg outline outline-2 outline-dashed outline-primary/60 bg-primary/5 p-1.5"
                    : "",
                ].join(" ")}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  void handleMediaDrop(event.dataTransfer.files?.[0]);
                }}
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => imageUploadInputRef.current?.click()}
                  className={compactMediaButtonClass}
                >
                  Upload image
                </button>
                <input
                  ref={imageUploadInputRef}
                  type="file"
                  accept="image/jpeg,.jpg,.jpeg"
                  className="hidden"
                  onChange={(event) => {
                    void handleImageUpload(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleGenerateImage()}
                  className={compactPrimaryButtonClass}
                >
                  {loading ? "Working…" : "Generate image"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleGenerateVideo()}
                  className={compactMediaButtonClass}
                >
                  {loading ? "Working…" : "Generate video"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => videoUploadInputRef.current?.click()}
                  className={compactMediaButtonClass}
                >
                  Upload video
                </button>
                <input
                  ref={videoUploadInputRef}
                  type="file"
                  accept="video/mp4,.mp4,video/webm,.webm"
                  className="hidden"
                  onChange={(event) => {
                    void handleVideoUpload(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </div>

              {mediaFilename ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 text-xs text-stone-500">
                    {mediaFilename}
                    {mediaBytes != null
                      ? ` · ${Math.round(mediaBytes / 1000)} KB`
                      : ""}
                    {mediaContentType ? ` · ${mediaContentType}` : ""}
                    {showOverlayPreview ? " · Footer applied" : ""}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      clearMedia();
                      setError(null);
                    }}
                    className={`${secondaryButtonClass} shrink-0 px-3 py-1.5 text-xs`}
                  >
                    {isImageMedia
                      ? "Remove image"
                      : isVideoMedia
                        ? "Remove video"
                        : "Remove media"}
                  </button>
                </div>
              ) : null}

              <WhatsAppImageOverlayControls
                overlay={overlay}
                onChange={setOverlay}
                onError={setError}
                disabled={busy || !isImageMedia}
                requirePhotoHint={!isImageMedia}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-stone-200 pt-4">
            <button
              type="button"
              disabled={busy || !body.trim()}
              onClick={() => void handleSaveTemplate()}
              className={primaryButtonClass}
            >
              {saving ? "Saving…" : "Save template"}
            </button>
          </div>
        </Panel>

        <Panel className="space-y-4 p-5 lg:sticky lg:top-6 lg:self-start">
          {channel === "WHATSAPP" ? (
            <WhatsAppPreview
              contactName={previewName.trim() || PREVIEW_NAME_PLACEHOLDER}
              messageText={body}
              videoUrl={isVideoMedia ? mediaPreviewUrl : null}
              imageUrl={
                isImageMedia && !showOverlayPreview ? mediaPreviewUrl : null
              }
              imageSlot={
                showOverlayPreview && mediaPreviewUrl ? (
                  <WhatsAppImageOverlayPreview
                    baseUrl={mediaPreviewUrl}
                    overlay={overlay}
                  />
                ) : undefined
              }
              layout={
                isImageMedia ? "image" : isVideoMedia ? "video" : "text"
              }
            />
          ) : (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
              <p className="font-medium text-stone-800">SMS preview</p>
              <p className="mt-1 whitespace-pre-wrap text-stone-900">
                {smsPreview ||
                  "Your draft will preview here with placeholder details."}
              </p>
            </div>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}
