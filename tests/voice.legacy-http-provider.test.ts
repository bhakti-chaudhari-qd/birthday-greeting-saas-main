import { describe, expect, it, vi } from "vitest";

import { createLegacyHttpVoiceProvider } from "@/lib/messaging/providers/voice/legacy-http-voice-provider";
import {
  mapLegacyVoiceStatusToError,
  parseLegacyVoiceResponse,
} from "@/lib/messaging/providers/voice/parse-response";

const baseConfig = {
  baseUrl: "http://voice-provider.example",
  sendPath: "/SendVoice.aspx",
  username: "panel-user",
  password: "panel-pass",
  route: "voice1",
  callerId: "9100000000",
  requestTimeoutMs: 100,
};

const audio = { bytes: Buffer.from("fake-mp3-bytes"), filename: "wishes.mp3" };

function callRequest(overrides: { providerFileId?: string | null } = {}) {
  return {
    channel: "CALL" as const,
    recipient: "9876543210",
    audio,
    idempotencyKey: "occasion:test",
    attemptNumber: 1,
    ...overrides,
  };
}

function fetchReturning(...bodies: string[]) {
  const fetchFn = vi.fn();
  for (const body of bodies) {
    fetchFn.mockResolvedValueOnce(new Response(body, { status: 200 }));
  }
  return fetchFn;
}

function formOf(fetchFn: ReturnType<typeof vi.fn>, call = 0): FormData {
  return fetchFn.mock.calls[call]![1].body as FormData;
}

describe("legacy voice response parsing", () => {
  it("reads the message id and file id from a success response", () => {
    expect(
      parseLegacyVoiceResponse(
        "1|000027061915050803400082|3c04144e-7e21-4ed4-8445-44d50fee98a6\n",
      ),
    ).toEqual({
      success: true,
      providerMessageId: "000027061915050803400082",
      fileId: "3c04144e-7e21-4ed4-8445-44d50fee98a6",
    });
  });

  it("treats any other status as a rejection", () => {
    expect(parseLegacyVoiceResponse("2")).toEqual({
      success: false,
      statusCode: 2,
    });
    expect(parseLegacyVoiceResponse("")).toEqual({
      success: false,
      statusCode: -1,
    });
    expect(parseLegacyVoiceResponse("<html>error</html>")).toEqual({
      success: false,
      statusCode: -1,
    });
    expect(parseLegacyVoiceResponse("1|")).toEqual({
      success: false,
      statusCode: -1,
    });
  });

  it("maps status 2 to invalid credentials and keeps unknown statuses visible", () => {
    expect(mapLegacyVoiceStatusToError(2).code).toBe("INVALID_CREDENTIALS");
    expect(mapLegacyVoiceStatusToError(7)).toEqual({
      code: "VOICE_PROVIDER_REJECTED",
      message: "Call provider rejected the call (status 7)",
    });
  });
});

describe("legacy HTTP voice provider", () => {
  it("posts the audio and call details as a multipart form", async () => {
    const fetchFn = fetchReturning("1|msg-1|file-1");
    const provider = createLegacyHttpVoiceProvider({ ...baseConfig, fetchFn });

    const result = await provider.send(callRequest());

    expect(result).toEqual({
      providerMessageId: "msg-1",
      status: "SENT",
      providerFileId: "file-1",
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]![0]).toBe(
      "http://voice-provider.example/SendVoice.aspx",
    );
    expect(fetchFn.mock.calls[0]![1].method).toBe("POST");

    const form = formOf(fetchFn);
    expect(form.get("Username")).toBe("panel-user");
    expect(form.get("Password")).toBe("panel-pass");
    expect(form.get("Route")).toBe("voice1");
    expect(form.get("Callerid")).toBe("9100000000");
    expect(form.get("Numbers")).toBe("919876543210");
    expect(form.get("NumberType")).toBe("M");
    expect(form.get("Repeat")).toBe("false");
    expect(form.get("OldFileId")).toBe("");

    const file = form.get("VoiceFile") as File;
    expect(file.name).toBe("wishes.mp3");
    expect(file.type).toBe("audio/mpeg");
    expect(Buffer.from(await file.arrayBuffer())).toEqual(audio.bytes);
  });

  it("reuses an uploaded file id instead of sending the audio again", async () => {
    const fetchFn = fetchReturning("1|msg-2|file-1");
    const provider = createLegacyHttpVoiceProvider({ ...baseConfig, fetchFn });

    const result = await provider.send(callRequest({ providerFileId: "file-1" }));

    const form = formOf(fetchFn);
    expect(form.get("OldFileId")).toBe("file-1");
    expect(form.has("VoiceFile")).toBe(false);
    expect(result.providerFileId).toBe("file-1");
  });

  it("uploads the audio again once when the stored file id is rejected", async () => {
    const fetchFn = fetchReturning("4", "1|msg-3|file-2");
    const provider = createLegacyHttpVoiceProvider({ ...baseConfig, fetchFn });

    const result = await provider.send(callRequest({ providerFileId: "stale" }));

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(formOf(fetchFn, 0).has("VoiceFile")).toBe(false);
    expect(formOf(fetchFn, 1).has("VoiceFile")).toBe(true);
    expect(formOf(fetchFn, 1).get("OldFileId")).toBe("");
    expect(result.providerFileId).toBe("file-2");
  });

  it("does not retry the upload when credentials are rejected", async () => {
    const fetchFn = fetchReturning("2");
    const provider = createLegacyHttpVoiceProvider({ ...baseConfig, fetchFn });

    await expect(
      provider.send(callRequest({ providerFileId: "file-1" })),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("reports a rejected call with the provider's status", async () => {
    const fetchFn = fetchReturning("7");
    const provider = createLegacyHttpVoiceProvider({ ...baseConfig, fetchFn });

    await expect(provider.send(callRequest())).rejects.toMatchObject({
      code: "VOICE_PROVIDER_REJECTED",
      message: "Call provider rejected the call (status 7)",
    });
  });

  it("treats server errors and network failures as unknown outcomes", async () => {
    const serverError = vi
      .fn()
      .mockResolvedValue(new Response("oops", { status: 500 }));
    await expect(
      createLegacyHttpVoiceProvider({ ...baseConfig, fetchFn: serverError }).send(
        callRequest(),
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_HTTP_5XX" });

    const networkError = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    await expect(
      createLegacyHttpVoiceProvider({ ...baseConfig, fetchFn: networkError }).send(
        callRequest(),
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_NETWORK_ERROR" });
  });

  it("times out a request the gateway never answers", async () => {
    const hanging = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    );

    await expect(
      createLegacyHttpVoiceProvider({
        ...baseConfig,
        fetchFn: hanging as unknown as typeof fetch,
      }).send(callRequest()),
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
  });

  it("rejects non-Indian numbers and empty recordings before calling the gateway", async () => {
    const fetchFn = vi.fn();
    const provider = createLegacyHttpVoiceProvider({ ...baseConfig, fetchFn });

    await expect(
      provider.send({ ...callRequest(), recipient: "12345" }),
    ).rejects.toMatchObject({ code: "INVALID_RECIPIENT" });
    await expect(
      provider.send({
        ...callRequest(),
        audio: { bytes: Buffer.alloc(0), filename: "empty.mp3" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_BODY" });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
