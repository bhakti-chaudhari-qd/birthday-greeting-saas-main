"use client";

import { useEffect, useRef, useState } from "react";

import { secondaryButtonClass } from "@/components/ui/page";
import { WHATSAPP_MEDIA_MAX_BYTES } from "@/lib/channel-config/whatsapp-types";
import {
  findFooterContentBounds,
  overlayFooterLayout,
} from "@/lib/media/overlay-footer-layout";

export type ImageOverlayState = {
  footerImageBase64: string | null;
  footerImageUrl: string | null;
  footerFilename: string | null;
};

export const EMPTY_IMAGE_OVERLAY: ImageOverlayState = {
  footerImageBase64: null,
  footerImageUrl: null,
  footerFilename: null,
};

export function hasImageOverlay(overlay: ImageOverlayState) {
  return Boolean(overlay.footerImageBase64);
}

export function revokeOverlayUrls(overlay: ImageOverlayState) {
  if (overlay.footerImageUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(overlay.footerImageUrl);
  }
}

function isOverlayImageFile(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    type === "image/jpeg" ||
    type === "image/png" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png")
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read image"));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function loadHtmlImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load preview image"));
    image.src = src;
  });
}

/**
 * Crop transparent / near-black padding so full-canvas footers don't leave a blank band.
 */
function trimFooterArtwork(source: HTMLImageElement): {
  image: HTMLCanvasElement | HTMLImageElement;
  width: number;
  height: number;
} {
  const probe = document.createElement("canvas");
  probe.width = source.width;
  probe.height = source.height;
  const probeCtx = probe.getContext("2d");
  if (!probeCtx) {
    throw new Error("Could not inspect footer image");
  }
  probeCtx.drawImage(source, 0, 0);
  const imageData = probeCtx.getImageData(0, 0, source.width, source.height);
  const bounds = findFooterContentBounds(
    imageData.data,
    source.width,
    source.height,
  );

  if (
    !bounds ||
    (bounds.left === 0 &&
      bounds.top === 0 &&
      bounds.width === source.width &&
      bounds.height === source.height)
  ) {
    return { image: source, width: source.width, height: source.height };
  }

  const trimmed = document.createElement("canvas");
  trimmed.width = bounds.width;
  trimmed.height = bounds.height;
  const trimmedCtx = trimmed.getContext("2d");
  if (!trimmedCtx) {
    throw new Error("Could not trim footer image");
  }
  trimmedCtx.drawImage(
    source,
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );
  return { image: trimmed, width: bounds.width, height: bounds.height };
}

type Props = {
  overlay: ImageOverlayState;
  onChange: (next: ImageOverlayState) => void;
  onError: (message: string | null) => void;
  disabled?: boolean;
  /** When true, explain that a main JPEG photo is required first. */
  requirePhotoHint?: boolean;
};

export function WhatsAppImageOverlayControls({
  overlay,
  onChange,
  onError,
  disabled,
  requirePhotoHint = false,
}: Props) {
  async function setFooter(file: File | undefined) {
    if (!file) return;
    if (requirePhotoHint) {
      onError("Upload the main photo (JPEG) first, then add a footer image");
      return;
    }
    if (!isOverlayImageFile(file) || file.size > WHATSAPP_MEDIA_MAX_BYTES) {
      onError("Choose a JPEG or PNG image within the size limit");
      return;
    }
    onError(null);
    const base64 = await readFileAsDataUrl(file);
    const url = URL.createObjectURL(file);
    if (overlay.footerImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(overlay.footerImageUrl);
    }
    onChange({
      footerImageBase64: base64,
      footerImageUrl: url,
      footerFilename: file.name,
    });
  }

  function clearFooter() {
    if (overlay.footerImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(overlay.footerImageUrl);
    }
    onChange(EMPTY_IMAGE_OVERLAY);
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3">
      <div>
        <p className="text-sm font-medium text-stone-800">Footer image</p>
        <p className="mt-1 text-xs text-stone-600">
          {requirePhotoHint
            ? "Upload a JPEG photo above first. Then you can add a footer that sits on that photo."
            : "Optional. Placed on your photo at the bottom and scaled to the photo width. Empty transparent/black padding above the artwork is removed automatically. Prefer a PNG with a transparent top for wavy edges."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <label
          className={[
            secondaryButtonClass,
            disabled ? "pointer-events-none opacity-60" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          Upload footer image
          <input
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            className="sr-only"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void setFooter(file);
            }}
          />
        </label>
        {overlay.footerFilename ? (
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={disabled}
            onClick={() => clearFooter()}
          >
            Remove footer
          </button>
        ) : null}
      </div>

      {overlay.footerFilename ? (
        <p className="text-xs text-stone-600">Footer: {overlay.footerFilename}</p>
      ) : null}
    </div>
  );
}

/** Canvas preview using the same overlay layout as server compose. */
export function WhatsAppImageOverlayPreview({
  baseUrl,
  overlay,
  className,
}: {
  baseUrl: string;
  overlay: ImageOverlayState;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const footerSrc = overlay.footerImageUrl || overlay.footerImageBase64;

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const base = await loadHtmlImage(baseUrl);
        if (cancelled) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Could not create canvas context");
        }

        if (!footerSrc) {
          const width = Math.min(720, base.width);
          const height = Math.max(
            1,
            Math.round((base.height / base.width) * width),
          );
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(base, 0, 0, width, height);
        } else {
          const footerSource = await loadHtmlImage(footerSrc);
          if (cancelled) return;
          const footer = trimFooterArtwork(footerSource);
          const layout = overlayFooterLayout(
            base.width,
            base.height,
            footer.width,
            footer.height,
            720,
          );
          canvas.width = layout.width;
          canvas.height = layout.height;
          ctx.drawImage(base, 0, 0, layout.width, layout.height);
          ctx.drawImage(
            footer.image,
            layout.footerX,
            layout.footerY,
            layout.footerDrawW,
            layout.footerDrawH,
          );
        }
        if (!cancelled) setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [baseUrl, footerSrc]);

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        className={[
          "block h-auto w-full max-w-full bg-stone-200",
          failed ? "hidden" : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {failed ? (
        <div className="flex min-h-[180px] w-full items-center justify-center bg-stone-200 text-xs text-stone-600">
          Could not build footer preview
        </div>
      ) : null}
    </div>
  );
}
