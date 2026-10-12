import { describe, expect, it } from "vitest";

import {
  CallAudioError,
  MAX_CALL_RECORDING_SECONDS,
  convertToCallMp3,
  parseFfmpegDurationSeconds,
} from "@/lib/voice/convert-audio";

const SAMPLE_RATE = 8000;

/** A mono 8-bit PCM WAV holding a plain tone of the given length. */
function buildWav(seconds: number): Buffer {
  const sampleCount = Math.floor(SAMPLE_RATE * seconds);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + sampleCount, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36);
  header.writeUInt32LE(sampleCount, 40);

  const samples = Buffer.alloc(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    samples[i] = 128 + Math.round(60 * Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE));
  }

  return Buffer.concat([header, samples]);
}

function looksLikeMp3(bytes: Buffer): boolean {
  const hasId3Tag = bytes.subarray(0, 3).toString("latin1") === "ID3";
  const hasFrameSync = bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0;
  return hasId3Tag || hasFrameSync;
}

describe("call audio conversion", () => {
  it("reads the encoded length from ffmpeg's last progress line", () => {
    expect(
      parseFfmpegDurationSeconds(
        "size=4kB time=00:00:01.00 bitrate=64\nsize=24kB time=00:00:03.05 bitrate=64",
      ),
    ).toBeCloseTo(3.05);
    expect(parseFfmpegDurationSeconds("no progress here")).toBeNull();
  });

  it("converts an uploaded recording to MP3 and reports its length", async () => {
    const result = await convertToCallMp3(buildWav(3));

    expect(looksLikeMp3(result.bytes)).toBe(true);
    expect(result.durationSeconds).toBe(3);
  });

  it("rejects a file that is not audio", async () => {
    await expect(
      convertToCallMp3(Buffer.from("this is not an audio file")),
    ).rejects.toBeInstanceOf(CallAudioError);
  });

  it("rejects an empty upload", async () => {
    await expect(convertToCallMp3(Buffer.alloc(0))).rejects.toThrow(
      "The recording is empty",
    );
  });

  it("rejects a recording longer than the limit instead of cutting it short", async () => {
    await expect(
      convertToCallMp3(buildWav(MAX_CALL_RECORDING_SECONDS + 5)),
    ).rejects.toThrow(/too long/);
  });
});
