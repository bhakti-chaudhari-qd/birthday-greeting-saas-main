import { NextResponse } from "next/server";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  CallMessageError,
  createCallMessage,
  isCallGatewayConfigured,
  listCallMessages,
} from "@/lib/voice/call-messages";
import {
  CallAudioError,
  MAX_CALL_AUDIO_UPLOAD_BYTES,
  MAX_CALL_RECORDING_SECONDS,
} from "@/lib/voice/convert-audio";

export const dynamic = "force-dynamic";
/** Audio conversion runs inside the request. */
export const maxDuration = 60;

export async function GET() {
  try {
    const auth = await requireSessionAdmin();
    const [messages, gatewayConfigured] = await Promise.all([
      listCallMessages(auth.organizationId),
      isCallGatewayConfigured(auth.organizationId),
    ]);

    return NextResponse.json({
      data: messages,
      meta: {
        gatewayConfigured,
        maxRecordingSeconds: MAX_CALL_RECORDING_SECONDS,
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) return authError;
    console.error("List call messages failed", error);
    return jsonError("Failed to load call recordings", 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError("Invalid call recording upload", 400);
    }

    const name = form.get("name");
    const occasionId = form.get("occasionId");
    const audio = form.get("audio");

    if (typeof name !== "string" || typeof occasionId !== "string") {
      return jsonError("Name and occasion are required", 400);
    }

    if (!(audio instanceof File) || audio.size === 0) {
      return jsonError("Record or upload an audio message first", 400);
    }

    if (audio.size > MAX_CALL_AUDIO_UPLOAD_BYTES) {
      return jsonError("The audio file is too large (8 MB maximum)", 400);
    }

    const message = await createCallMessage(auth.organizationId, {
      name,
      occasionId,
      audio: Buffer.from(await audio.arrayBuffer()),
    });

    return NextResponse.json({ data: message }, { status: 201 });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) return authError;
    if (error instanceof CallMessageError || error instanceof CallAudioError) {
      return jsonError(error.message, 400);
    }
    console.error("Create call message failed", error);
    return jsonError("Failed to save the call recording", 500);
  }
}
