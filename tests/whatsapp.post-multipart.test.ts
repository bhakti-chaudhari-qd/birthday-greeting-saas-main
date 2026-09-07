import http from "node:http";
import { describe, expect, it } from "vitest";

import {
  describeNetworkError,
  postWhatsAppMultipart,
} from "@/lib/messaging/providers/whatsapp/post-multipart";

describe("postWhatsAppMultipart", () => {
  it("describes nested network errors for debugging", () => {
    const cause = new Error("unable to verify the first certificate");
    const error = Object.assign(new Error("fetch failed"), {
      cause,
      code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    });

    expect(describeNetworkError(error)).toMatch(/unable to verify/i);
    expect(describeNetworkError(error)).toMatch(
      /UNABLE_TO_VERIFY_LEAF_SIGNATURE/,
    );
  });

  it("posts multipart fields over HTTP like CustomAPI form-data", async () => {
    const { port, close, bodyPromise } = await new Promise<{
      port: number;
      close: () => Promise<void>;
      bodyPromise: Promise<string>;
    }>((resolve, reject) => {
      let bodyResolve!: (value: string) => void;
      const bodyPromise = new Promise<string>((r) => {
        bodyResolve = r;
      });

      const server = http.createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          bodyResolve(Buffer.concat(chunks).toString("utf8"));
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              messaging_product: "whatsapp",
              messages: [{ id: "wamid.LOCAL", message_status: "accepted" }],
              error: null,
            }),
          );
        });
      });

      server.on("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          reject(new Error("server address unavailable"));
          return;
        }

        resolve({
          port: address.port,
          bodyPromise,
          close: () =>
            new Promise<void>((closeResolve, closeReject) => {
              server.close((error) =>
                error ? closeReject(error) : closeResolve(),
              );
            }),
        });
      });
    });

    try {
      const result = await postWhatsAppMultipart(
        `http://127.0.0.1:${port}/api/CustomAPI/CustomAPI_SendWhatsApp`,
        {
          username: "wa-user",
          MobileNumber: "919876543210",
          TemplateName: "services",
          language: "en",
        },
        {
          fieldName: "file",
          filename: "test.jpg",
          contentType: "image/jpeg",
          bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
        },
        { timeoutMs: 5_000, tlsInsecure: true },
      );

      expect(result.status).toBe(200);
      expect(result.bodyText).toContain("wamid.LOCAL");

      const body = await bodyPromise;
      expect(body).toContain('name="username"');
      expect(body).toContain("wa-user");
      expect(body).toContain('name="TemplateName"');
      expect(body).toContain("services");
      expect(body).toContain('filename="test.jpg"');
    } finally {
      await close();
    }
  });
});
