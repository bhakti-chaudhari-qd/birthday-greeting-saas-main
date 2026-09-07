import { createHash } from "node:crypto";

import { prisma } from "@/lib/db";
import {
  decodeWhatsAppMediaBase64,
  defaultFilenameForMediaType,
  type WhatsAppMediaContentType,
} from "@/lib/channel-config/whatsapp-types";

export class WhatsAppMediaAssetError extends Error {}

function safeFilename(
  filename: string | undefined,
  contentType: WhatsAppMediaContentType,
) {
  const value = filename?.trim() || defaultFilenameForMediaType(contentType);
  if (value.length > 120 || /[\\/\0]/.test(value)) {
    throw new WhatsAppMediaAssetError("Invalid media filename");
  }
  return value;
}

export function serializeWhatsAppMediaAsset(asset: {
  id: string;
  filename: string;
  contentType: string;
  byteLength: number;
  createdAt: Date;
}) {
  return {
    id: asset.id,
    filename: asset.filename,
    contentType: asset.contentType,
    byteLength: asset.byteLength,
    previewUrl: `/api/v1/whatsapp-media/${asset.id}`,
    createdAt: asset.createdAt.toISOString(),
  };
}

export async function createWhatsAppMediaAsset(
  organizationId: string,
  input: {
    mediaBase64: string;
    filename?: string;
    contentType?: WhatsAppMediaContentType;
  },
) {
  let decoded;
  try {
    decoded = decodeWhatsAppMediaBase64(input.mediaBase64);
  } catch (error) {
    throw new WhatsAppMediaAssetError(
      error instanceof Error ? error.message : "Invalid WhatsApp media",
    );
  }

  if (input.contentType && input.contentType !== decoded.contentType) {
    throw new WhatsAppMediaAssetError(
      "Media content does not match the selected file type",
    );
  }

  return createWhatsAppMediaAssetFromBytes(organizationId, {
    bytes: decoded.bytes,
    filename: input.filename,
    contentType: decoded.contentType,
  });
}

export async function createWhatsAppMediaAssetFromBytes(
  organizationId: string,
  input: {
    bytes: Buffer;
    filename?: string;
    contentType: WhatsAppMediaContentType;
  },
) {
  const filename = safeFilename(input.filename, input.contentType);
  const checksum = createHash("sha256").update(input.bytes).digest("hex");
  const existing = await prisma.whatsAppMediaAsset.findFirst({
    where: { organizationId, checksum },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.whatsAppMediaAsset.create({
    data: {
      organizationId,
      bytes: Uint8Array.from(input.bytes),
      filename,
      contentType: input.contentType,
      byteLength: input.bytes.length,
      checksum,
    },
  });
}

export async function getWhatsAppMediaAsset(
  organizationId: string,
  assetId: string,
) {
  const asset = await prisma.whatsAppMediaAsset.findFirst({
    where: { id: assetId, organizationId },
  });
  if (!asset) {
    throw new WhatsAppMediaAssetError("WhatsApp media was not found");
  }
  return asset;
}

export async function assertWhatsAppMediaAssetForOrganization(
  organizationId: string,
  assetId: string | null | undefined,
) {
  if (!assetId) {
    return null;
  }
  return getWhatsAppMediaAsset(organizationId, assetId);
}
