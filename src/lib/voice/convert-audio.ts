import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import ffmpegPath from "ffmpeg-static";

/** Longest recorded message a call will play. */
export const MAX_CALL_RECORDING_SECONDS = 60;
export const MIN_CALL_RECORDING_SECONDS = 1;
/** Largest audio file accepted for upload, before conversion. */
export const MAX_CALL_AUDIO_UPLOAD_BYTES = 8 * 1024 * 1024;

export class CallAudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CallAudioError";
  }
}

function runFfmpeg(args: string[]): Promise<{ code: number | null; stderr: string }> {
  const binary = ffmpegPath;
  if (!binary) {
    throw new Error("ffmpeg binary is not available");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(binary as string, args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code: number | null) => resolve({ code, stderr }));
  });
}

/** Length of the encoded output, read from ffmpeg's last progress line. */
export function parseFfmpegDurationSeconds(stderr: string): number | null {
  const matches = [...stderr.matchAll(/time=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/g)];
  const last = matches.at(-1);
  if (!last) {
    return null;
  }

  const seconds =
    Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
  return Number.isFinite(seconds) ? seconds : null;
}

/**
 * Converts whatever the browser recorded or the client uploaded (WebM, OGG,
 * M4A, WAV, MP3...) into the mono MP3 the voice gateway requires.
 */
export async function convertToCallMp3(
  input: Buffer,
): Promise<{ bytes: Buffer; durationSeconds: number }> {
  if (input.length === 0) {
    throw new CallAudioError("The recording is empty");
  }

  if (input.length > MAX_CALL_AUDIO_UPLOAD_BYTES) {
    throw new CallAudioError("The audio file is too large (8 MB maximum)");
  }

  const workDir = await fs.mkdtemp(join(tmpdir(), "call-audio-"));
  const inputPath = join(workDir, "input");
  const outputPath = join(workDir, "output.mp3");

  try {
    await fs.writeFile(inputPath, input);

    const { code, stderr } = await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-vn",
      // One second past the limit, so an over-long recording is detected
      // below rather than silently cut short.
      "-t",
      String(MAX_CALL_RECORDING_SECONDS + 1),
      "-ac",
      "1",
      "-ar",
      "44100",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "64k",
      "-f",
      "mp3",
      outputPath,
    ]);

    if (code !== 0) {
      throw new CallAudioError(
        "This file could not be read as audio. Record again or upload an MP3, WAV or M4A file.",
      );
    }

    const bytes = await fs.readFile(outputPath);
    const durationSeconds = parseFfmpegDurationSeconds(stderr);

    if (bytes.length === 0 || durationSeconds === null) {
      throw new CallAudioError(
        "This file could not be read as audio. Record again or upload an MP3, WAV or M4A file.",
      );
    }

    if (durationSeconds < MIN_CALL_RECORDING_SECONDS) {
      throw new CallAudioError("The recording is too short");
    }

    if (durationSeconds > MAX_CALL_RECORDING_SECONDS) {
      throw new CallAudioError(
        `The recording is too long. Keep it under ${MAX_CALL_RECORDING_SECONDS} seconds.`,
      );
    }

    return { bytes, durationSeconds: Math.max(1, Math.round(durationSeconds)) };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
