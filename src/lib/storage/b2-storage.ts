import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  DocumentStorageNotConfiguredError,
  DocumentStorageOperationError,
} from "./errors";
import type { DocumentStorage } from "./types";

type B2Config = {
  endpoint: string;
  region: string;
  applicationKeyId: string;
  applicationKey: string;
  bucketName: string;
};

function readB2Config(): B2Config | null {
  const endpoint = process.env.B2_ENDPOINT?.trim();
  const region = process.env.B2_REGION?.trim();
  const applicationKeyId = process.env.B2_APPLICATION_KEY_ID?.trim();
  const applicationKey = process.env.B2_APPLICATION_KEY?.trim();
  const bucketName = process.env.B2_BUCKET_NAME?.trim();

  if (!endpoint || !region || !applicationKeyId || !applicationKey || !bucketName) {
    return null;
  }

  return { endpoint, region, applicationKeyId, applicationKey, bucketName };
}

let cached: { key: string; client: S3Client; bucketName: string } | null = null;

/**
 * Lazily builds a single S3Client for Backblaze B2's S3-compatible API -
 * the one place B2 configuration/client creation happens. Same shape as
 * the R2 adapter this replaced; only the config source differs (B2 gives
 * an explicit endpoint/region instead of deriving one from an account id).
 */
function getB2Client(): { client: S3Client; bucketName: string } {
  const config = readB2Config();
  if (!config) {
    throw new DocumentStorageNotConfiguredError();
  }

  const key = `${config.endpoint}:${config.applicationKeyId}:${config.bucketName}`;
  if (cached && cached.key === key) {
    return cached;
  }

  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.applicationKeyId,
      secretAccessKey: config.applicationKey,
    },
  });

  cached = { key, client, bucketName: config.bucketName };
  return cached;
}

async function bodyToUint8Array(body: unknown): Promise<Uint8Array> {
  const stream = body as { transformToByteArray: () => Promise<Uint8Array> };
  return stream.transformToByteArray();
}

export const b2Storage: DocumentStorage = {
  async upload(key, bytes, contentType) {
    const { client, bucketName } = getB2Client();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: bytes,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      console.error("B2 upload failed", { key, error });
      throw new DocumentStorageOperationError("upload");
    }
  },

  async download(key) {
    const { client, bucketName } = getB2Client();
    try {
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucketName, Key: key }),
      );
      if (!response.Body) {
        throw new Error("Empty response body");
      }
      return await bodyToUint8Array(response.Body);
    } catch (error) {
      console.error("B2 download failed", { key, error });
      throw new DocumentStorageOperationError("download");
    }
  },

  async delete(key) {
    const { client, bucketName } = getB2Client();
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucketName, Key: key }),
      );
    } catch (error) {
      console.error("B2 delete failed", { key, error });
      throw new DocumentStorageOperationError("delete");
    }
  },
};
