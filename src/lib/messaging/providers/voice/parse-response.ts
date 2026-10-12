export type ParsedVoiceSuccess = {
  success: true;
  providerMessageId: string;
  /** Id of the uploaded audio; pass it back as OldFileId to skip re-uploading. */
  fileId: string | null;
};

export type ParsedVoiceFailure = {
  success: false;
  statusCode: number;
};

export type ParsedVoiceResponse = ParsedVoiceSuccess | ParsedVoiceFailure;

/**
 * Parses the voice gateway's pipe-delimited send response.
 * Success is `1|smsid|fileid`; any other leading status is a rejection.
 */
export function parseLegacyVoiceResponse(raw: string): ParsedVoiceResponse {
  const trimmed = raw.trim().replace(/^﻿/, "");

  if (!trimmed) {
    return { success: false, statusCode: -1 };
  }

  const parts = trimmed.split("|").map((part) => part.trim());
  const statusCode = Number.parseInt(parts[0] ?? "", 10);

  if (!Number.isInteger(statusCode) || String(statusCode) !== parts[0]) {
    return { success: false, statusCode: -1 };
  }

  if (statusCode !== 1) {
    return { success: false, statusCode };
  }

  const providerMessageId = parts[1] ?? "";

  if (!providerMessageId) {
    return { success: false, statusCode: -1 };
  }

  return {
    success: true,
    providerMessageId,
    fileId: parts[2] || null,
  };
}

/**
 * The gateway documents only status 1 (success) and 2 (invalid credentials)
 * for voice. Every other status is reported as-is and is not retried
 * automatically, since its meaning is not documented.
 */
export function mapLegacyVoiceStatusToError(statusCode: number): {
  code: string;
  message: string;
} {
  if (statusCode === 2) {
    return {
      code: "INVALID_CREDENTIALS",
      message: "Invalid call provider credentials",
    };
  }

  if (statusCode === -1) {
    return {
      code: "VOICE_PROVIDER_REJECTED",
      message: "Call provider returned an unrecognized response",
    };
  }

  return {
    code: "VOICE_PROVIDER_REJECTED",
    message: `Call provider rejected the call (status ${statusCode})`,
  };
}
