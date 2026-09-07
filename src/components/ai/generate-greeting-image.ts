/**
 * Browser-only greeting image generator for AI writing tools.
 * Renders a canvas greeting card and exports it as JPEG.
 */

export type GreetingImageResult = {
  blob: Blob;
  contentType: "image/jpeg";
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

function drawGreetingImage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  occasionName: string,
  recipientName: string,
) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "hsl(38, 72%, 46%)");
  gradient.addColorStop(1, "hsl(185, 48%, 27%)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 6; i += 1) {
    const x = ((i * 97 + 90) % (width + 80)) - 40;
    const y = height * (0.2 + ((i * 37) % 60) / 100);
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${0.08 + (i % 3) * 0.03})`;
    ctx.arc(x, y, 28 + (i % 4) * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  const headline = resolveGreetingHeadline(occasionName);

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "700 42px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.fillText(headline, width / 2, height * 0.42);

  ctx.fillStyle = "rgba(255,248,240,0.95)";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText(recipientName.trim() || "Friend", width / 2, height * 0.58);

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "400 16px system-ui, sans-serif";
  ctx.fillText("With warm wishes", width / 2, height * 0.72);
}

/**
 * Generate a personalized greeting JPEG on a canvas.
 */
export async function generateGreetingImage(options: {
  occasionName: string;
  recipientName: string;
}): Promise<GreetingImageResult> {
  const width = 640;
  const height = 360;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create image canvas");
  }

  drawGreetingImage(
    ctx,
    width,
    height,
    options.occasionName,
    options.recipientName,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result && result.size > 0) {
          resolve(result);
          return;
        }
        reject(new Error("Generated image was empty"));
      },
      "image/jpeg",
      0.92,
    );
  });

  const filename = `greeting-${slugifyOccasionName(options.occasionName)}.jpg`;
  return {
    blob,
    contentType: "image/jpeg",
    filename,
    previewUrl: URL.createObjectURL(blob),
    byteLength: blob.size,
  };
}
