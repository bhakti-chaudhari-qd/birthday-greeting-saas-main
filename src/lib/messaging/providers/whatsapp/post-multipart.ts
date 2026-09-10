import http from "node:http";
import https from "node:https";
import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { URL } from "node:url";

export type WhatsAppMultipartFile = {
  fieldName: string;
  filename: string;
  contentType: string;
  bytes: Buffer;
};

export type WhatsAppMultipartPostResult = {
  status: number;
  bodyText: string;
};

/**
 * Multipart POST for Custom HTTP WhatsApp gateways.
 * Supports optional TLS verification skip for temporary IP/self-signed test hosts
 * (Postman often succeeds where Node's default fetch fails).
 */
export async function postWhatsAppMultipart(
  requestUrl: string,
  fields: Record<string, string>,
  file: WhatsAppMultipartFile,
  options: {
    timeoutMs: number;
    /** When true, do not reject unauthorized/self-signed TLS certificates. */
    tlsInsecure?: boolean;
  },
): Promise<WhatsAppMultipartPostResult> {
  const parsed = new URL(requestUrl);
  const boundary = `----BirthdayWa${randomBytes(12).toString("hex")}`;
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${escapeDisposition(
          name,
        )}"\r\n\r\n${value}\r\n`,
        "utf8",
      ),
    );
  }

  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${escapeDisposition(
        file.fieldName,
      )}"; filename="${escapeDisposition(file.filename)}"\r\nContent-Type: ${
        file.contentType
      }\r\n\r\n`,
      "utf8",
    ),
  );
  chunks.push(file.bytes);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"));

  const body = Buffer.concat(chunks);
  const isHttps = parsed.protocol === "https:";
  const transport = isHttps ? https : http;
  const tlsInsecure = options.tlsInsecure === true;

  if (process.env.NODE_ENV === "production" && tlsInsecure) {
    throw new Error(
      "Insecure TLS (tlsInsecure) is not allowed for WhatsApp in production",
    );
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port
          ? Number(parsed.port)
          : isHttps
            ? 443
            : 80,
        path: `${parsed.pathname}${parsed.search}`,
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
          Accept: "application/json, text/plain, */*",
        },
        timeout: options.timeoutMs,
        ...(isHttps
          ? {
              rejectUnauthorized: !tlsInsecure,
              // SNI cannot be an IP address (TLS spec) - omit servername
              // entirely for IP hosts so Node doesn't throw ERR_INVALID_ARG_VALUE.
              ...(isIP(parsed.hostname) === 0
                ? { servername: parsed.hostname }
                : {}),
            }
          : {}),
      },
      (res) => {
        const data: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          data.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            bodyText: Buffer.concat(data).toString("utf8"),
          });
        });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      reject(error);
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(body);
    req.end();
  });
}

function escapeDisposition(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function describeNetworkError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "WhatsApp provider network error";
  }

  const parts = [error.message];
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error && cause.message) {
    parts.push(cause.message);
  }

  const code = (error as NodeJS.ErrnoException).code;
  if (code) {
    parts.push(`(${code})`);
  }

  return `WhatsApp provider network error: ${parts.filter(Boolean).join(" - ")}`;
}
