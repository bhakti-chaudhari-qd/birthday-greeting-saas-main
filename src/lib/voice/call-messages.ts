import { createHash } from "node:crypto";

import { Channel, ChannelProvider, type ChannelConfig } from "@prisma/client";

import { getEffectiveChannelConfig } from "@/lib/channel-config/platform-defaults";
import {
  resolveVoiceProviderConfig,
  voiceProviderFileKey,
} from "@/lib/channel-config/voice-resolve";
import { prisma } from "@/lib/db";
import { ProviderSendError } from "@/lib/messaging/providers/types";
import { findTemplateByNameAndChannel } from "@/lib/templates/service";

import { convertToCallMp3 } from "./convert-audio";

export class CallMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CallMessageError";
  }
}

export class CallMessageNotFoundError extends Error {
  constructor() {
    super("Call recording not found");
    this.name = "CallMessageNotFoundError";
  }
}

/** Stored as the template body; a call has no text, only the recording. */
const CALL_TEMPLATE_BODY = "Recorded voice message";
const CALL_AUDIO_CONTENT_TYPE = "audio/mpeg";

const CALL_MESSAGE_INCLUDE = {
  occasion: { select: { id: true, name: true } },
  voiceRecording: {
    select: { id: true, byteLength: true, durationSeconds: true },
  },
  _count: { select: { categoryRuleCallFor: true } },
} as const;

type CallMessageRow = {
  id: string;
  name: string;
  occasionId: string;
  createdAt: Date;
  occasion: { id: string; name: string };
  voiceRecording: {
    id: string;
    byteLength: number;
    durationSeconds: number;
  } | null;
  _count: { categoryRuleCallFor: number };
};

export function serializeCallMessage(message: CallMessageRow) {
  return {
    id: message.id,
    name: message.name,
    occasionId: message.occasionId,
    occasionName: message.occasion.name,
    durationSeconds: message.voiceRecording?.durationSeconds ?? 0,
    byteLength: message.voiceRecording?.byteLength ?? 0,
    audioUrl: `/api/v1/call-messages/${message.id}/audio`,
    /** How many automatic greeting rules currently play this recording. */
    usedByRoutes: message._count.categoryRuleCallFor,
    createdAt: message.createdAt.toISOString(),
  };
}

export type SerializedCallMessage = ReturnType<typeof serializeCallMessage>;

/** Whether automated calls can go out for this client at all. */
export async function isCallGatewayConfigured(
  organizationId: string,
): Promise<boolean> {
  return Boolean(await getEffectiveChannelConfig(organizationId, Channel.CALL));
}

export async function listCallMessages(
  organizationId: string,
): Promise<SerializedCallMessage[]> {
  const messages = await prisma.messageTemplate.findMany({
    where: {
      organizationId,
      channel: Channel.CALL,
      isActive: true,
      voiceRecordingId: { not: null },
    },
    include: CALL_MESSAGE_INCLUDE,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return messages.map(serializeCallMessage);
}

function slugifyFilename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "call-message"}.mp3`;
}

/**
 * Saves a recorded (or uploaded) voice message as a call message for one
 * occasion. The audio is converted to MP3 first, whatever format it came in.
 */
export async function createCallMessage(
  organizationId: string,
  input: { name: string; occasionId: string; audio: Buffer },
): Promise<SerializedCallMessage> {
  const name = input.name.trim();
  if (!name || name.length > 100) {
    throw new CallMessageError("Give the recording a name (100 characters maximum)");
  }

  const occasion = await prisma.occasion.findFirst({
    where: { id: input.occasionId, organizationId },
    select: { id: true },
  });
  if (!occasion) {
    throw new CallMessageError("Choose an occasion for this recording");
  }

  const existing = await findTemplateByNameAndChannel(
    organizationId,
    name,
    Channel.CALL,
  );
  if (existing?.isActive) {
    throw new CallMessageError(
      `A call recording named “${name}” already exists. Use a different name.`,
    );
  }

  const converted = await convertToCallMp3(input.audio);
  const checksum = createHash("sha256").update(converted.bytes).digest("hex");

  const created = await prisma.$transaction(async (tx) => {
    const recording = await tx.voiceRecording.create({
      data: {
        organizationId,
        bytes: Uint8Array.from(converted.bytes),
        filename: slugifyFilename(name),
        contentType: CALL_AUDIO_CONTENT_TYPE,
        byteLength: converted.bytes.length,
        durationSeconds: converted.durationSeconds,
        checksum,
      },
      select: { id: true },
    });

    return tx.messageTemplate.create({
      data: {
        organizationId,
        name,
        occasionId: occasion.id,
        channel: Channel.CALL,
        body: CALL_TEMPLATE_BODY,
        voiceRecordingId: recording.id,
        isActive: true,
      },
      include: CALL_MESSAGE_INCLUDE,
    });
  });

  return serializeCallMessage(created);
}

/**
 * Removes a call message. Automation rules that played it stop calling. A
 * message that already has call history is kept (inactive) so that history
 * still shows what was sent.
 */
export async function deleteCallMessage(
  organizationId: string,
  callMessageId: string,
): Promise<void> {
  const message = await prisma.messageTemplate.findFirst({
    where: { id: callMessageId, organizationId, channel: Channel.CALL },
    select: {
      id: true,
      voiceRecordingId: true,
      _count: { select: { sendQueues: true } },
    },
  });

  if (!message) {
    throw new CallMessageNotFoundError();
  }

  await prisma.$transaction(async (tx) => {
    await tx.categoryAutomationRule.updateMany({
      where: { organizationId, callTemplateId: message.id },
      data: { callEnabled: false, callTemplateId: null },
    });

    if (message._count.sendQueues > 0) {
      await tx.messageTemplate.update({
        where: { id: message.id },
        data: { isActive: false },
      });
      return;
    }

    await tx.messageTemplate.delete({ where: { id: message.id } });
    if (message.voiceRecordingId) {
      await tx.voiceRecording.delete({
        where: { id: message.voiceRecordingId },
      });
    }
  });
}

export async function getCallMessageAudio(
  organizationId: string,
  callMessageId: string,
) {
  const message = await prisma.messageTemplate.findFirst({
    where: { id: callMessageId, organizationId, channel: Channel.CALL },
    select: {
      voiceRecording: {
        select: {
          bytes: true,
          filename: true,
          contentType: true,
          byteLength: true,
        },
      },
    },
  });

  if (!message?.voiceRecording) {
    throw new CallMessageNotFoundError();
  }

  return message.voiceRecording;
}

/**
 * Key of the gateway account an uploaded-audio id is valid on, or null when
 * the id must not be reused (anything but a real voice gateway).
 */
function callProviderFileKey(channelConfig: ChannelConfig | null): string | null {
  if (!channelConfig || channelConfig.provider !== ChannelProvider.CUSTOM_HTTP) {
    return null;
  }

  try {
    return voiceProviderFileKey(resolveVoiceProviderConfig(channelConfig));
  } catch {
    return null;
  }
}

export type CallRecordingForSend = {
  id: string;
  bytes: Buffer;
  filename: string;
  /** Id of this audio on the gateway being used, when already uploaded there. */
  providerFileId: string | null;
  providerFileKey: string | null;
};

/** Loads the audio a queued call plays. Throws a definite, pre-send error if it is gone. */
export async function loadCallRecordingForSend(
  organizationId: string,
  voiceRecordingId: string | null,
  channelConfig: ChannelConfig | null,
): Promise<CallRecordingForSend> {
  const recording = voiceRecordingId
    ? await prisma.voiceRecording.findFirst({
        where: { id: voiceRecordingId, organizationId },
        select: {
          id: true,
          bytes: true,
          filename: true,
          providerFileId: true,
          providerFileKey: true,
        },
      })
    : null;

  if (!recording) {
    throw new ProviderSendError(
      "The recording for this call was deleted",
      "INVALID_BODY",
    );
  }

  const providerFileKey = callProviderFileKey(channelConfig);

  return {
    id: recording.id,
    bytes: Buffer.from(recording.bytes),
    filename: recording.filename,
    providerFileId:
      providerFileKey && recording.providerFileKey === providerFileKey
        ? recording.providerFileId
        : null,
    providerFileKey,
  };
}

/**
 * Remembers the gateway's id for this audio so later calls skip the upload.
 * Best effort: a failure here only costs a repeat upload.
 */
export async function rememberCallRecordingProviderFile(
  recording: CallRecordingForSend,
  providerFileId: string | undefined,
): Promise<void> {
  if (
    !providerFileId ||
    !recording.providerFileKey ||
    providerFileId === recording.providerFileId
  ) {
    return;
  }

  try {
    await prisma.voiceRecording.update({
      where: { id: recording.id },
      data: { providerFileId, providerFileKey: recording.providerFileKey },
    });
  } catch (error) {
    console.error("Failed to store call provider file id", {
      recordingId: recording.id,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
