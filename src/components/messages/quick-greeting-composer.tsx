"use client";

import { useEffect, useState } from "react";

import { generateGreetingImage } from "@/components/ai/generate-greeting-image";
import {
  blobToBase64,
  recordGreetingVideo,
} from "@/components/ai/generate-greeting-video";
import { WhatsAppPreview } from "@/components/ai/whatsapp-preview";
import {
  EMPTY_IMAGE_OVERLAY,
  hasImageOverlay,
  revokeOverlayUrls,
  WhatsAppImageOverlayControls,
  WhatsAppImageOverlayPreview,
  type ImageOverlayState,
} from "@/components/messages/whatsapp-image-overlay-controls";
import { InlineAlert } from "@/components/ui/feedback";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";
import {
  WHATSAPP_MEDIA_MAX_BYTES,
  type WhatsAppMediaContentType,
} from "@/lib/channel-config/whatsapp-types";
import { getMessagesDict, type MessagesDict } from "@/lib/i18n/dictionaries/messages";
import { useLocale } from "@/lib/i18n/use-locale";
import { templateNameForOccasionMedia } from "@/lib/templates/whatsapp-template-name";

type Channel = "SMS" | "WHATSAPP" | "EMAIL";
type Occasion = "BIRTHDAY" | "ANNIVERSARY" | "CUSTOM";

function occasionDisplayName(
  occasion: Occasion,
  names: MessagesDict["composer"]["occasionNames"],
): string {
  const map: Record<Occasion, string> = {
    BIRTHDAY: names.birthday,
    ANNIVERSARY: names.anniversary,
    CUSTOM: names.custom,
  };
  return map[occasion];
}

type Props = {
  channel: Channel;
  provider: "TEST" | "CUSTOM_HTTP" | null;
  onCreated: (templateId: string, occasion: Occasion) => void;
};

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read media file"));
    reader.onerror = () => reject(new Error("Could not read media file"));
    reader.readAsDataURL(file);
  });
}

function isJpegFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return type === "image/jpeg" || name.endsWith(".jpg") || name.endsWith(".jpeg");
}

function isVideoFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    type === "video/mp4" ||
    type === "video/webm" ||
    name.endsWith(".mp4") ||
    name.endsWith(".webm")
  );
}

function resolveVideoContentType(file: File): "video/mp4" | "video/webm" {
  if (file.type === "video/webm" || file.name.toLowerCase().endsWith(".webm")) {
    return "video/webm";
  }
  return "video/mp4";
}

export function QuickGreetingComposer({ channel, provider, onCreated }: Props) {
  const dict = getMessagesDict(useLocale()).composer;
  const [occasion, setOccasion] = useState<Occasion>("BIRTHDAY");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [body, setBody] = useState(dict.defaultBody);
  const [emailSubject, setEmailSubject] = useState(dict.defaultEmailSubject);
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaFilename, setMediaFilename] = useState<string | null>(null);
  const [mediaContentType, setMediaContentType] =
    useState<WhatsAppMediaContentType | null>(null);
  const [providerTemplateName, setProviderTemplateName] = useState("");
  const [providerLanguage, setProviderLanguage] = useState("en");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<ImageOverlayState>(EMPTY_IMAGE_OVERLAY);

  const isImageMedia = mediaContentType === "image/jpeg";
  const isVideoMedia =
    mediaContentType === "video/mp4" || mediaContentType === "video/webm";
  const showOverlayPreview = isImageMedia && Boolean(mediaUrl) && hasImageOverlay(overlay);

  useEffect(() => {
    let cancelled = false;
    async function loadCategories() {
      try {
        const response = await fetch("/api/v1/contact-categories");
        const bodyJson = await response.json();
        if (!response.ok || cancelled) return;
        setCategories(
          (bodyJson.data as Array<{ id: string; name: string }>).map((item) => ({
            id: item.id,
            name: item.name,
          })),
        );
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
    const timer = window.setTimeout(() => {
      try {
        const raw = sessionStorage.getItem("greeting-compose-draft");
        if (!raw) return;
        const draft = JSON.parse(raw) as {
          occasionType?: Occasion;
          body?: string;
          mediaBase64?: string;
          mediaFilename?: string;
          mediaContentType?: WhatsAppMediaContentType;
        };
        if (draft.occasionType) setOccasion(draft.occasionType);
        if (draft.body) setBody(draft.body);
        if (
          draft.mediaBase64 &&
          draft.mediaFilename &&
          draft.mediaContentType
        ) {
          setMediaBase64(draft.mediaBase64);
          setMediaUrl(draft.mediaBase64);
          setMediaFilename(draft.mediaFilename);
          setMediaContentType(draft.mediaContentType);
        }
        sessionStorage.removeItem("greeting-compose-draft");
      } catch {
        sessionStorage.removeItem("greeting-compose-draft");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (mediaUrl?.startsWith("blob:")) URL.revokeObjectURL(mediaUrl);
      revokeOverlayUrls(overlay);
    };
    // Only revoke on unmount / mediaUrl change; overlay revoke handled on clear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaUrl]);

  function clearOverlay() {
    revokeOverlayUrls(overlay);
    setOverlay(EMPTY_IMAGE_OVERLAY);
  }

  function clearMedia() {
    if (mediaUrl?.startsWith("blob:")) URL.revokeObjectURL(mediaUrl);
    setMediaBase64(null);
    setMediaUrl(null);
    setMediaFilename(null);
    setMediaContentType(null);
    clearOverlay();
  }

  async function suggestMessage() {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/ai/suggest-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasionType: occasion,
          channel: channel === "EMAIL" ? "SMS" : channel,
          tone: "warm",
          variantCount: 1,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message);
      const suggestion = payload.data?.body ?? payload.data?.variants?.[0];
      if (suggestion) setBody(suggestion);
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : dict.errors.couldNotWriteMessage,
      );
    } finally {
      setWorking(false);
    }
  }

  async function selectImage(file: File) {
    if (!isJpegFile(file) || file.size > WHATSAPP_MEDIA_MAX_BYTES) {
      setError(dict.errors.chooseJpegImage);
      return;
    }
    const base64 = await readFileAsBase64(file);
    if (mediaUrl?.startsWith("blob:")) URL.revokeObjectURL(mediaUrl);
    setMediaBase64(base64);
    setMediaUrl(URL.createObjectURL(file));
    setMediaFilename(file.name);
    setMediaContentType("image/jpeg");
    setError(null);
  }

  async function selectVideo(file: File) {
    if (!isVideoFile(file) || file.size > WHATSAPP_MEDIA_MAX_BYTES) {
      setError(dict.errors.chooseVideo);
      return;
    }
    const base64 = await readFileAsBase64(file);
    if (mediaUrl?.startsWith("blob:")) URL.revokeObjectURL(mediaUrl);
    clearOverlay();
    setMediaBase64(base64);
    setMediaUrl(URL.createObjectURL(file));
    setMediaFilename(file.name);
    setMediaContentType(resolveVideoContentType(file));
    setError(null);
  }

  async function generateImage() {
    setWorking(true);
    setError(null);
    try {
      const result = await generateGreetingImage({
        occasionName: occasionDisplayName(occasion, dict.occasionNames),
        recipientName: "Alex",
      });
      if (mediaUrl?.startsWith("blob:")) URL.revokeObjectURL(mediaUrl);
      clearOverlay();
      setMediaBase64(await blobToBase64(result.blob));
      setMediaUrl(result.previewUrl);
      setMediaFilename(result.filename);
      setMediaContentType(result.contentType);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.errors.couldNotGenerateImage);
    } finally {
      setWorking(false);
    }
  }

  async function generateVideo() {
    setWorking(true);
    setError(null);
    try {
      const result = await recordGreetingVideo({
        occasionName: occasionDisplayName(occasion, dict.occasionNames),
        recipientName: "Alex",
      });
      if (mediaUrl?.startsWith("blob:")) URL.revokeObjectURL(mediaUrl);
      clearOverlay();
      setMediaBase64(await blobToBase64(result.blob));
      setMediaUrl(result.previewUrl);
      setMediaFilename(result.filename);
      setMediaContentType(result.contentType);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.errors.couldNotGenerateVideo);
    } finally {
      setWorking(false);
    }
  }

  async function uploadWhatsAppMedia(): Promise<string | undefined> {
    if (
      channel !== "WHATSAPP" ||
      !mediaBase64 ||
      !mediaFilename ||
      !mediaContentType
    ) {
      return undefined;
    }

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
        throw new Error(composePayload.error?.message);
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
    if (!mediaResponse.ok) throw new Error(mediaPayload.error?.message);
    return mediaPayload.data.id as string;
  }

  async function saveMessage() {
    setWorking(true);
    setError(null);
    try {
      const whatsappMediaAssetId = await uploadWhatsAppMedia();

      const payload: Record<string, unknown> = {
        name: templateNameForOccasionMedia(
          occasion,
          channel === "WHATSAPP" ? mediaContentType : null,
        ),
        type: occasion,
        channel,
        body,
        categoryId: categoryId || null,
        isActive: true,
        replaceExisting: true,
      };
      if (channel === "EMAIL") payload.emailSubject = emailSubject;
      if (channel === "WHATSAPP") {
        payload.whatsappTemplateName =
          provider === "TEST"
            ? `test_${occasion.toLowerCase()}_greeting`
            : providerTemplateName;
        payload.whatsappLanguage = providerLanguage;
        if (whatsappMediaAssetId) payload.whatsappMediaAssetId = whatsappMediaAssetId;
      }

      const response = await fetch("/api/v1/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message);
      onCreated(result.data.id, occasion);
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : dict.errors.couldNotSaveMessage,
      );
    } finally {
      setWorking(false);
    }
  }

  const previewLayout = isImageMedia
    ? "image"
    : isVideoMedia
      ? "video"
      : "text";

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">{dict.title}</h2>
        <p className="mt-1 text-sm text-stone-600">{dict.subtitle}</p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.occasionLabel}</span>
            <select
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              value={occasion}
              onChange={(event) => setOccasion(event.target.value as Occasion)}
            >
              <option value="BIRTHDAY">{dict.occasionNames.birthday}</option>
              <option value="ANNIVERSARY">{dict.occasionNames.anniversary}</option>
              <option value="CUSTOM">{dict.occasionNames.custom}</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.groupLabel}</span>
            <select
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">{dict.allGroups}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          {channel === "EMAIL" ? (
            <label className="block text-sm">
              <span className="font-medium text-stone-800">{dict.subjectLabel}</span>
              <input
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                value={emailSubject}
                onChange={(event) => setEmailSubject(event.target.value)}
              />
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.messageLabel}</span>
            <textarea
              className="mt-1 min-h-32 w-full rounded-lg border border-stone-300 px-3 py-2"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={working}
            onClick={() => void suggestMessage()}
          >
            {dict.writeWithAi}
          </button>
          {channel === "WHATSAPP" ? (
            <div className="space-y-3 rounded-lg border border-stone-200 p-3">
              <p className="text-sm font-medium text-stone-800">{dict.mediaOptionalLabel}</p>
              <p className="text-xs text-stone-600">{dict.mediaHint}</p>
              <div className="flex flex-wrap gap-2">
                <label className={secondaryButtonClass}>
                  {dict.uploadImage}
                  <input
                    type="file"
                    accept="image/jpeg,.jpg,.jpeg"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void selectImage(file);
                      event.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={working}
                  onClick={() => void generateImage()}
                >
                  {dict.generateImage}
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={working}
                  onClick={() => void generateVideo()}
                >
                  {dict.generateVideo}
                </button>
                <label className={secondaryButtonClass}>
                  {dict.uploadVideo}
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void selectVideo(file);
                      event.target.value = "";
                    }}
                  />
                </label>
                {mediaBase64 ? (
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => clearMedia()}
                  >
                    {dict.removeMedia}
                  </button>
                ) : null}
              </div>
              {mediaFilename ? (
                <p className="text-xs text-stone-600">
                  {dict.selectedPrefix} {mediaFilename}
                  {isImageMedia ? dict.imageSuffix : isVideoMedia ? dict.videoSuffix : ""}
                  {showOverlayPreview ? dict.footerAppliedSuffix : ""}
                </p>
              ) : null}
              {isImageMedia && mediaUrl ? (
                <div className="rounded-lg border border-stone-200 bg-stone-200 max-w-md">
                  {showOverlayPreview ? (
                    <WhatsAppImageOverlayPreview
                      baseUrl={mediaUrl}
                      overlay={overlay}
                      className="max-h-[360px]"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- blob preview URL
                    <img
                      src={mediaUrl}
                      alt={dict.imageAlt}
                      className="mx-auto block h-auto max-h-[360px] w-auto max-w-full bg-stone-200"
                    />
                  )}
                </div>
              ) : isVideoMedia && mediaUrl ? (
                <video
                  src={mediaUrl}
                  controls
                  playsInline
                  className="aspect-video w-full max-w-md rounded-lg border border-stone-200 bg-black"
                />
              ) : null}
              <WhatsAppImageOverlayControls
                overlay={overlay}
                onChange={setOverlay}
                onError={setError}
                disabled={working || !isImageMedia}
                requirePhotoHint={!isImageMedia}
              />
              {provider === "CUSTOM_HTTP" ? (
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-stone-700">
                    {dict.deliverySetup}
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      {dict.providerTemplateName}
                      <input
                        className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                        value={providerTemplateName}
                        onChange={(event) => setProviderTemplateName(event.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      {dict.language}
                      <input
                        className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                        value={providerLanguage}
                        onChange={(event) => setProviderLanguage(event.target.value)}
                      />
                    </label>
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}
          {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
          <button
            type="button"
            className={primaryButtonClass}
            disabled={working || !body.trim()}
            onClick={() => void saveMessage()}
          >
            {working ? dict.preparing : dict.useThisMessage}
          </button>
        </div>
        <div className="space-y-3">
          {channel === "WHATSAPP" ? (
            <WhatsAppPreview
              contactName="Alex"
              messageText={body}
              videoUrl={isVideoMedia ? mediaUrl : null}
              imageUrl={
                isImageMedia && !showOverlayPreview ? mediaUrl : null
              }
              imageSlot={
                showOverlayPreview && mediaUrl ? (
                  <WhatsAppImageOverlayPreview
                    baseUrl={mediaUrl}
                    overlay={overlay}
                  />
                ) : undefined
              }
              layout={previewLayout}
            />
          ) : (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-5">
              <p className="text-xs font-medium uppercase text-stone-500">{dict.previewLabel}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-stone-800">
                {body.replaceAll("{{name}}", "Alex")}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
