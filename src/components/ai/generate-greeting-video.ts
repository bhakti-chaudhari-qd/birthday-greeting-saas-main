/**
 * Browser-only greeting video recorder for AI writing tools.
 * Renders a short canvas animation and captures it with MediaRecorder.
 */

export type GreetingVideoResult = {
  blob: Blob;
  contentType: "video/webm" | "video/mp4";
  filename: string;
  previewUrl: string;
  byteLength: number;
};

/** "Birthday" -> "Happy Birthday"; any other occasion name -> "Happy {name}". */
function resolveGreetingHeadline(occasionName: string): string {
  const trimmed = occasionName.trim();
  return trimmed ? `Happy ${trimmed}` : "Warm Wishes";
}

/** Filesystem/URL-safe slug for filenames, e.g. "Work Anniversary" -> "work-anniversary". */
function slugifyOccasionName(occasionName: string): string {
  const slug = occasionName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "occasion";
}

function pickRecorderMimeType(): {
  mimeType: string;
  contentType: "video/webm" | "video/mp4";
  extension: string;
} {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Video recording is not supported in this browser");
  }

  const candidates: Array<{
    mimeType: string;
    contentType: "video/webm" | "video/mp4";
    extension: string;
  }> = [
    {
      mimeType: "video/webm;codecs=vp9",
      contentType: "video/webm",
      extension: "webm",
    },
    {
      mimeType: "video/webm;codecs=vp8",
      contentType: "video/webm",
      extension: "webm",
    },
    { mimeType: "video/webm", contentType: "video/webm", extension: "webm" },
    { mimeType: "video/mp4", contentType: "video/mp4", extension: "mp4" },
  ];

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }

  throw new Error("No supported video format for MediaRecorder");
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  occasionName: string,
  recipientName: string,
) {
  const t = progress;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `hsl(${28 + t * 20}, 72%, ${42 + t * 8}%)`);
  gradient.addColorStop(1, `hsl(${200 - t * 30}, 48%, ${22 + t * 10}%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Soft moving orbs
  for (let i = 0; i < 6; i += 1) {
    const x = ((i * 97 + t * 180) % (width + 80)) - 40;
    const y = height * (0.2 + ((i * 37) % 60) / 100) + Math.sin(t * 6 + i) * 12;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${0.08 + (i % 3) * 0.03})`;
    ctx.arc(x, y, 28 + (i % 4) * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  const headline = resolveGreetingHeadline(occasionName);
  const scale = 0.92 + Math.sin(t * Math.PI) * 0.08;

  ctx.save();
  ctx.translate(width / 2, height * 0.42);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "700 42px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.fillText(headline, 0, 0);
  ctx.restore();

  ctx.fillStyle = "rgba(255,248,240,0.95)";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(recipientName.trim() || "Friend", width / 2, height * 0.58);

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "400 16px system-ui, sans-serif";
  ctx.fillText("With warm wishes", width / 2, height * 0.72);
}

/**
 * Record a ~4s personalized greeting video as WebM/MP4.
 */
export async function recordGreetingVideo(options: {
  occasionName: string;
  recipientName: string;
  durationMs?: number;
}): Promise<GreetingVideoResult> {
  const durationMs = options.durationMs ?? 4000;
  const width = 640;
  const height = 360;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create video canvas");
  }

  const { mimeType, contentType, extension } = pickRecorderMimeType();
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 800_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Video recording failed"));
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: contentType }));
    };
  });

  recorder.start(200);

  const startedAt = performance.now();
  await new Promise<void>((resolve) => {
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      drawFrame(
        ctx,
        width,
        height,
        progress,
        options.occasionName,
        options.recipientName,
      );
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  for (const track of stream.getTracks()) {
    track.stop();
  }

  const blob = await stopped;
  if (blob.size === 0) {
    throw new Error("Generated video was empty");
  }

  const filename = `greeting-${slugifyOccasionName(options.occasionName)}.${extension}`;
  return {
    blob,
    contentType,
    filename,
    previewUrl: URL.createObjectURL(blob),
    byteLength: blob.size,
  };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
