import { Resend } from "resend";

import { getPlatformFromAddress } from "./platform-from";

function getAppBaseUrl(): string {
  const configured =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return configured.replace(/\/$/, "");
}

export type SendEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: SendEmailAttachment[];
  /** Per-organization override - falls back to RESEND_API_KEY when omitted. */
  apiKey?: string;
  /** Per-organization override - falls back to EMAIL_FROM/RESEND_FROM_EMAIL when omitted. */
  from?: string;
};

/**
 * Sends mail via Resend when an API key is available (per-organization
 * override, or the platform-wide RESEND_API_KEY env var as a fallback for
 * organizations that haven't configured their own).
 * In development/test without any key, logs the message (still succeeds).
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = input.apiKey?.trim() || process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is required to send email in production");
    }

    console.info("[email:dev]", {
      to: input.to,
      subject: input.subject,
      text: input.text,
      attachments: input.attachments?.map((attachment) => attachment.filename),
    });
    return;
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: input.from?.trim() || getPlatformFromAddress(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    ...(input.attachments && input.attachments.length > 0
      ? { attachments: input.attachments }
      : {}),
  });

  if (result.error) {
    throw new Error(result.error.message || "Failed to send email");
  }
}

export function buildResetPasswordUrl(rawToken: string): string {
  return `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string,
): Promise<void> {
  const url = buildResetPasswordUrl(rawToken);
  await sendEmail({
    to,
    subject: "Reset your password - Birthday Greeting",
    text: `Reset your password by opening this link (valid 1 hour, single use):\n\n${url}\n`,
    html: `<p>Reset your Birthday Greeting password.</p><p><a href="${url}">Reset password</a></p><p>This link expires in 1 hour and can be used once.</p>`,
  });
}
