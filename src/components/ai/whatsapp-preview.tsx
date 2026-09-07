"use client";

import type { ReactNode } from "react";

type WhatsAppPreviewProps = {
  contactName: string;
  messageText: string;
  videoUrl?: string | null;
  imageUrl?: string | null;
  /** Custom image area (e.g. branded overlay preview) inside the WhatsApp bubble. */
  imageSlot?: ReactNode;
  /** text = message bubble only; video/image = media + caption layout */
  layout?: "text" | "video" | "image";
};

function renderMessageText(text: string, sampleName: string) {
  return text.replace(/\{\{name\}\}/g, sampleName).trim();
}

export function WhatsAppPreview({
  contactName,
  messageText,
  videoUrl,
  imageUrl,
  imageSlot,
  layout = "video",
}: WhatsAppPreviewProps) {
  const rendered = renderMessageText(messageText, contactName);
  const hasVideo = Boolean(videoUrl);
  const hasImage = Boolean(imageUrl) || Boolean(imageSlot);
  const hasText = rendered.length > 0;
  const isMediaLayout = layout === "video" || layout === "image";
  const showContent = isMediaLayout
    ? hasVideo || hasImage || hasText
    : hasText;

  return (
    <div className="mx-auto w-full max-w-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
        WhatsApp preview
      </p>
      <div className="overflow-hidden rounded-2xl border border-stone-300 shadow-md">
        <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
            {contactName.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{contactName}</p>
            <p className="text-xs text-white/80">online</p>
          </div>
        </div>

        <div
          className="min-h-[220px] bg-[#ece5dd] px-3 py-4"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(0,0,0,0.03) 0, transparent 50%), radial-gradient(circle at 80% 0%, rgba(0,0,0,0.03) 0, transparent 45%)",
          }}
        >
          {showContent ? (
            <div className="ml-auto max-w-[88%]">
              <div
                className={[
                  "overflow-hidden bg-[#dcf8c6] shadow-sm",
                  isMediaLayout
                    ? "rounded-lg rounded-tr-none"
                    : "rounded-lg rounded-tr-none px-2.5 py-2",
                ].join(" ")}
              >
                {layout === "video" ? (
                  hasVideo ? (
                    <video
                      src={videoUrl ?? undefined}
                      controls
                      playsInline
                      className="aspect-video w-full bg-black"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center bg-stone-300/60 text-xs text-stone-600">
                      Video will appear here
                    </div>
                  )
                ) : null}
                {layout === "image" ? (
                  imageSlot ? (
                    <div className="w-full bg-stone-200">{imageSlot}</div>
                  ) : hasImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- blob/data preview URL
                    <img
                      src={imageUrl ?? undefined}
                      alt="WhatsApp image preview"
                      className="mx-auto block h-auto max-h-[420px] w-auto max-w-full bg-stone-200"
                    />
                  ) : (
                    <div className="flex min-h-[180px] w-full items-center justify-center bg-stone-300/60 text-xs text-stone-600">
                      Image will appear here
                    </div>
                  )
                ) : null}
                {hasText ? (
                  <p
                    className={[
                      "whitespace-pre-wrap text-sm leading-snug text-stone-900",
                      isMediaLayout ? "px-2.5 py-2" : "",
                    ].join(" ")}
                  >
                    {rendered}
                  </p>
                ) : null}
                <div
                  className={[
                    "flex items-center justify-end gap-1 text-[10px] text-stone-500",
                    isMediaLayout ? "px-2 pb-1.5" : "pt-1",
                  ].join(" ")}
                >
                  <span>12:30</span>
                  <span aria-hidden className="text-sky-600">
                    ✓✓
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-stone-500">
              {layout === "video"
                ? "Add a message and video to see how the greeting looks on WhatsApp."
                : layout === "image"
                  ? "Add a message and image to see how the greeting looks on WhatsApp."
                  : "Type or suggest a message to preview it on WhatsApp."}
            </p>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Mock only - live delivery depends on your approved WhatsApp template and
        provider.
      </p>
    </div>
  );
}
