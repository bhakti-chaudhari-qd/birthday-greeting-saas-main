import { Channel } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

import { sendEmail } from "@/lib/email/send";
import { createResendEmailProvider } from "@/lib/messaging/providers/email/resend-email-provider";

describe("generic email attachment contract", () => {
  const originalApiKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
    process.env.RESEND_API_KEY = "test-key";
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalApiKey;
    }
  });

  it("sends without attachments exactly as before when none are provided", async () => {
    await sendEmail({
      to: "a@example.com",
      subject: "Hi",
      text: "Hello",
      html: "<p>Hello</p>",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]?.[0]?.attachments).toBeUndefined();
  });

  it("forwards a PDF attachment with the correct filename, content, and content type to Resend", async () => {
    const content = Buffer.from("%PDF-1.4 fake");

    await sendEmail({
      to: "a@example.com",
      subject: "Hi",
      text: "Hello",
      html: "<p>Hello</p>",
      attachments: [
        {
          filename: "Birthday-Greeting-Ishika.pdf",
          content,
          contentType: "application/pdf",
        },
      ],
    });

    expect(sendMock.mock.calls[0]?.[0]?.attachments).toEqual([
      {
        filename: "Birthday-Greeting-Ishika.pdf",
        content,
        contentType: "application/pdf",
      },
    ]);
  });

  it("resend provider forwards the generic attachment through unchanged (no Resend-specific shape upstream)", async () => {
    const provider = createResendEmailProvider();
    const content = Buffer.from("%PDF-1.4 fake");

    const result = await provider.send({
      channel: Channel.EMAIL,
      recipient: "customer@example.com",
      subject: "Happy Birthday",
      body: "Enjoy your day",
      idempotencyKey: "email-attach-test",
      attemptNumber: 1,
      attachments: [
        { filename: "greeting.pdf", content, contentType: "application/pdf" },
      ],
    });

    expect(result.status).toBe("SENT");
    expect(sendMock.mock.calls[0]?.[0]?.attachments).toEqual([
      { filename: "greeting.pdf", content, contentType: "application/pdf" },
    ]);
  });

  it("resend provider still sends a normal email unchanged when no attachment is given", async () => {
    const provider = createResendEmailProvider();

    const result = await provider.send({
      channel: Channel.EMAIL,
      recipient: "customer@example.com",
      subject: "Happy Birthday",
      body: "Enjoy your day",
      idempotencyKey: "email-no-attach-test",
      attemptNumber: 1,
    });

    expect(result.status).toBe("SENT");
    expect(sendMock.mock.calls[0]?.[0]?.attachments).toBeUndefined();
  });
});
