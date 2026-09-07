import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

import { createCanvas } from "@napi-rs/canvas";
import ffmpegPath from "ffmpeg-static";

import { prisma } from "@/lib/db";

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

const WIDTH = 640;
const HEIGHT = 360;
const FPS = 10;
const DURATION_SEC = 4;
const FRAME_COUNT = FPS * DURATION_SEC;

function drawFrame(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  progress: number,
  occasionName: string,
  recipientName: string,
) {
  if (!ctx) {
    throw new Error("Could not create video canvas");
  }

  const t = progress;
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, `hsl(${28 + t * 20}, 72%, ${42 + t * 8}%)`);
  gradient.addColorStop(1, `hsl(${200 - t * 30}, 48%, ${22 + t * 10}%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let i = 0; i < 6; i += 1) {
    const x = ((i * 97 + t * 180) % (WIDTH + 80)) - 40;
    const y =
      HEIGHT * (0.2 + ((i * 37) % 60) / 100) + Math.sin(t * 6 + i) * 12;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${0.08 + (i % 3) * 0.03})`;
    ctx.arc(x, y, 28 + (i % 4) * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  const headline = resolveGreetingHeadline(occasionName);
  const scale = 0.92 + Math.sin(t * Math.PI) * 0.08;

  ctx.save();
  ctx.translate(WIDTH / 2, HEIGHT * 0.42);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "700 42px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.fillText(headline, 0, 0);
  ctx.restore();

  ctx.fillStyle = "rgba(255,248,240,0.95)";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(recipientName.trim() || "Friend", WIDTH / 2, HEIGHT * 0.58);

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "400 16px system-ui, sans-serif";
  ctx.fillText("With warm wishes", WIDTH / 2, HEIGHT * 0.72);
}

async function runFfmpeg(args: string[]) {
  const binary = ffmpegPath;
  if (!binary) {
    throw new Error("ffmpeg binary is not available");
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary as string, args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-500)}`));
    });
  });
}

/**
 * Render a short personalized greeting WebM (same visual language as the
 * browser Send Messages generator).
 */
export async function renderPersonalizedGreetingVideo(options: {
  occasionName: string;
  recipientName: string;
}): Promise<{ bytes: Buffer; filename: string; contentType: "video/webm" }> {
  const workDir = await fs.mkdtemp(join(tmpdir(), "greeting-video-"));
  const outputPath = join(workDir, "out.webm");
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  try {
    for (let i = 0; i < FRAME_COUNT; i += 1) {
      const progress = i / Math.max(1, FRAME_COUNT - 1);
      drawFrame(ctx, progress, options.occasionName, options.recipientName);
      const png = await canvas.encode("png");
      await fs.writeFile(
        join(workDir, `frame-${String(i).padStart(3, "0")}.png`),
        png,
      );
    }

    await runFfmpeg([
      "-y",
      "-framerate",
      String(FPS),
      "-i",
      join(workDir, "frame-%03d.png"),
      "-c:v",
      "libvpx",
      "-b:v",
      "800k",
      "-auto-alt-ref",
      "0",
      "-pix_fmt",
      "yuv420p",
      outputPath,
    ]);

    const bytes = await fs.readFile(outputPath);
    if (bytes.length === 0) {
      throw new Error("Generated personalized video was empty");
    }

    return {
      bytes,
      filename: `greeting-${slugifyOccasionName(options.occasionName)}-${Date.now()}.webm`,
      contentType: "video/webm",
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Create (or reuse by checksum) a WhatsApp media asset personalized for one
 * recipient. Used when queueing automation / manual WhatsApp sends.
 */
export async function createPersonalizedGreetingMediaAsset(
  organizationId: string,
  options: {
    occasionName: string;
    recipientName: string;
    contactId: string;
  },
) {
  const rendered = await renderPersonalizedGreetingVideo({
    occasionName: options.occasionName,
    recipientName: options.recipientName,
  });

  // Include contact id so people with the same name still get distinct files.
  // when content differs only by metadata - checksum still dedupes identical bytes.
  const checksum = createHash("sha256")
    .update(rendered.bytes)
    .update(`\n${options.contactId}`)
    .digest("hex");

  const existing = await prisma.whatsAppMediaAsset.findFirst({
    where: { organizationId, checksum },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return existing;
  }

  const safeName = `greeting-${slugifyOccasionName(options.occasionName)}-${options.contactId.slice(-6)}.webm`;

  return prisma.whatsAppMediaAsset.create({
    data: {
      organizationId,
      bytes: Uint8Array.from(rendered.bytes),
      filename: safeName,
      contentType: rendered.contentType,
      byteLength: rendered.bytes.length,
      checksum,
    },
  });
}
