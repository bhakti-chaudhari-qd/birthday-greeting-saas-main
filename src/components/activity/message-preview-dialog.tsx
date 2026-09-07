"use client";

import { useEffect, useState } from "react";

import { recordGreetingVideo } from "@/components/ai/generate-greeting-video";
import { WhatsAppPreview } from "@/components/ai/whatsapp-preview";
import { secondaryButtonClass } from "@/components/ui/page";
import { needsGreetingVideoPreviewRebuild } from "@/lib/media/greeting-video-filename";

export type MessagePreviewPart = {
  channel: string;
  templateName: string | null;
  messageBody: string | null;
  mediaPreviewUrl: string | null;
  mediaFilename?: string | null;
};

function resolveOccasion(occasionName?: string | null): string {
  return occasionName?.trim() || "Birthday";
}

function isJpegMediaFilename(filename?: string | null) {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return lower.endsWith(".jpg") || lower.endsWith(".jpeg");
}

export function PersonalizedWhatsAppPreview({
  contactName,
  messageBody,
  mediaPreviewUrl,
  mediaFilename,
  occasionName,
  mediaContentType,
}: {
  contactName: string;
  messageBody: string | null;
  mediaPreviewUrl: string | null;
  mediaFilename?: string | null;
  occasionName?: string | null;
  mediaContentType?: string | null;
}) {
  const isImage =
    mediaContentType === "image/jpeg" || isJpegMediaFilename(mediaFilename);

  const needsLiveBuild =
    Boolean(mediaPreviewUrl) &&
    !isImage &&
    needsGreetingVideoPreviewRebuild(mediaFilename);

  const [videoUrl, setVideoUrl] = useState<string | null>(
    needsLiveBuild ? null : isImage ? null : mediaPreviewUrl,
  );
  const [loadingVideo, setLoadingVideo] = useState(needsLiveBuild);
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadVideo() {
      if (!mediaPreviewUrl) {
        setVideoUrl(null);
        setLoadingVideo(false);
        setVideoError(null);
        return;
      }

      // Already-personalized queue media (or custom upload): play as stored.
      if (isImage || !needsGreetingVideoPreviewRebuild(mediaFilename)) {
        setVideoUrl(isImage ? null : mediaPreviewUrl);
        setLoadingVideo(false);
        setVideoError(null);
        return;
      }

      setLoadingVideo(true);
      setVideoError(null);
      try {
        // Prefer browser MediaRecorder - same path as AI Studio, no native
        // server deps. Fall back to the server renderer if needed.
        try {
          const result = await recordGreetingVideo({
            occasionName: resolveOccasion(occasionName),
            recipientName: contactName.trim() || "Friend",
          });
          if (cancelled) {
            URL.revokeObjectURL(result.previewUrl);
            return;
          }
          objectUrl = result.previewUrl;
          setVideoUrl(result.previewUrl);
          return;
        } catch {
          // continue to server fallback
        }

        const response = await fetch("/api/v1/media/greeting-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientName: contactName.trim() || "Friend",
            occasionName: resolveOccasion(occasionName),
          }),
        });
        if (!response.ok) {
          throw new Error("Failed to build personalized preview");
        }
        const blob = await response.blob();
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
      } catch {
        if (!cancelled) {
          // Never fall back to the shared placeholder video.
          setVideoUrl(null);
          setVideoError(
            `Could not build a personalized video for ${contactName}.`,
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingVideo(false);
        }
      }
    }

    void loadVideo();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [contactName, isImage, mediaFilename, mediaPreviewUrl, occasionName]);

  if (isImage && mediaPreviewUrl) {
    return (
      <WhatsAppPreview
        contactName={contactName}
        messageText={messageBody ?? ""}
        imageUrl={mediaPreviewUrl}
        layout="image"
      />
    );
  }

  if (loadingVideo) {
    return (
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-stone-300 bg-[#ece5dd] px-4 py-16 text-center text-sm text-stone-600 shadow-md">
        Building WhatsApp preview for {contactName}…
      </div>
    );
  }

  if (videoError) {
    return (
      <div className="space-y-3">
        <div className="mx-auto w-full max-w-sm rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">
          {videoError}
        </div>
        <WhatsAppPreview
          contactName={contactName}
          messageText={messageBody ?? ""}
          videoUrl={null}
          layout={mediaPreviewUrl ? "video" : "text"}
        />
      </div>
    );
  }

  return (
    <WhatsAppPreview
      contactName={contactName}
      messageText={messageBody ?? ""}
      videoUrl={videoUrl}
      layout={mediaPreviewUrl ? "video" : "text"}
    />
  );
}

export function MessagePreviewDialog({
  open,
  contactName,
  parts,
  occasionName,
  onClose,
}: {
  open: boolean;
  contactName: string;
  parts: MessagePreviewPart[];
  occasionName?: string | null;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="message-preview-title"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="message-preview-title"
              className="text-lg font-semibold text-stone-900"
            >
              Message preview
            </h2>
            {parts.some((part) => part.templateName) ? (
              <p className="mt-1 text-sm text-stone-600">
                {parts
                  .map((part) => part.templateName)
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-5">
          {parts.length === 0 ? (
            <p className="text-sm text-stone-600">No message content available.</p>
          ) : (
            parts.map((part) => {
              const isWhatsApp = part.channel === "WHATSAPP";

              if (isWhatsApp) {
                return (
                  <PersonalizedWhatsAppPreview
                    key={`${part.channel}-${part.templateName ?? "none"}-${contactName}`}
                    contactName={contactName}
                    messageBody={part.messageBody}
                    mediaPreviewUrl={part.mediaPreviewUrl}
                    mediaFilename={part.mediaFilename}
                    occasionName={occasionName}
                  />
                );
              }

              return (
                <section
                  key={`${part.channel}-${part.templateName ?? "none"}`}
                  className="rounded-xl border border-stone-200 bg-stone-50 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    {part.channel}
                  </p>
                  {part.templateName ? (
                    <p className="mt-1 text-sm font-medium text-stone-900">
                      {part.templateName}
                    </p>
                  ) : null}
                  {part.messageBody ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-800">
                      {part.messageBody}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-stone-500">
                      No message text for this channel.
                    </p>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
