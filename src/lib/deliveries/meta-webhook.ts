import { createHmac, timingSafeEqual } from "node:crypto";

import { DeliveryStatus, Prisma, QueueStatus } from "@prisma/client";

import { prisma } from "@/lib/db";

/** lastErrorCode for a message Meta accepted and then failed to deliver. */
export const META_DELIVERY_FAILED = "META_DELIVERY_FAILED";

export type MetaWebhookConfig = {
  /** Shared string typed into Meta's "Verify token" field. */
  verifyToken: string;
  /** The Meta app's App Secret, used to check each delivery's signature. */
  appSecret: string;
};

/** Null (webhook off) unless both values are set. */
export function getMetaWebhookConfig(
  env: NodeJS.ProcessEnv = process.env,
): MetaWebhookConfig | null {
  const verifyToken = env.META_WEBHOOK_VERIFY_TOKEN?.trim();
  const appSecret = env.META_WEBHOOK_APP_SECRET?.trim();
  if (!verifyToken || !appSecret) {
    return null;
  }
  return { verifyToken, appSecret };
}

/** Meta signs the raw body: `X-Hub-Signature-256: sha256=<hex hmac>`. */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export type MetaStatusUpdate = {
  /** The wamid Meta returned when the message was accepted. */
  messageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  errorCode: string | null;
  errorMessage: string | null;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Pulls the per-message status updates out of a WhatsApp webhook payload. */
export function extractMetaStatusUpdates(payload: unknown): MetaStatusUpdate[] {
  const updates: MetaStatusUpdate[] = [];
  const entries = (payload as { entry?: unknown })?.entry;

  for (const entry of Array.isArray(entries) ? entries : []) {
    const changes = (entry as { changes?: unknown })?.changes;
    for (const change of Array.isArray(changes) ? changes : []) {
      const statuses = (change as { value?: { statuses?: unknown } })?.value
        ?.statuses;
      for (const raw of Array.isArray(statuses) ? statuses : []) {
        const item = raw as {
          id?: unknown;
          status?: unknown;
          errors?: Array<{
            code?: unknown;
            title?: unknown;
            message?: unknown;
            error_data?: { details?: unknown };
          }>;
        };
        const messageId = text(item.id);
        const status = text(item.status);
        if (
          !messageId ||
          (status !== "sent" &&
            status !== "delivered" &&
            status !== "read" &&
            status !== "failed")
        ) {
          continue;
        }

        const error = Array.isArray(item.errors) ? item.errors[0] : undefined;
        updates.push({
          messageId,
          status,
          errorCode:
            typeof error?.code === "number" || typeof error?.code === "string"
              ? String(error.code)
              : null,
          errorMessage:
            text(error?.error_data?.details) ??
            text(error?.message) ??
            text(error?.title),
        });
      }
    }
  }

  return updates;
}

export function describeMetaDeliveryFailure(update: MetaStatusUpdate): string {
  const reason = update.errorMessage ?? "No reason was given";
  return update.errorCode
    ? `WhatsApp did not deliver this message: ${reason} (Meta error ${update.errorCode})`
    : `WhatsApp did not deliver this message: ${reason}`;
}

export type MetaStatusApplyResult = "updated" | "ignored" | "unknown_message";

function withMetaStatus(
  providerResponse: Prisma.JsonValue | null,
  update: MetaStatusUpdate,
): Prisma.InputJsonValue {
  const base =
    providerResponse && typeof providerResponse === "object" && !Array.isArray(providerResponse)
      ? (providerResponse as Prisma.JsonObject)
      : {};
  return {
    ...base,
    metaStatus: {
      status: update.status,
      ...(update.errorCode ? { errorCode: update.errorCode } : {}),
      ...(update.errorMessage ? { errorMessage: update.errorMessage } : {}),
    },
  };
}

/**
 * Records Meta's verdict on a message this app submitted. Statuses only move
 * forward (submitted → delivered → read, or submitted → failed), so a late or
 * duplicate webhook can never undo a later state.
 */
export async function applyMetaStatusUpdate(
  update: MetaStatusUpdate,
): Promise<MetaStatusApplyResult> {
  if (update.status === "sent") {
    return "ignored";
  }

  const log = await prisma.deliveryLog.findFirst({
    where: { providerMessageId: update.messageId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      organizationId: true,
      sendQueueId: true,
      status: true,
      providerResponse: true,
    },
  });

  if (!log) {
    return "unknown_message";
  }

  const providerResponse = withMetaStatus(log.providerResponse, update);

  return prisma.$transaction(async (tx) => {
    if (update.status === "failed") {
      const logUpdate = await tx.deliveryLog.updateMany({
        where: { id: log.id, status: DeliveryStatus.SENT },
        data: {
          status: DeliveryStatus.UNDELIVERED,
          errorCode: META_DELIVERY_FAILED,
          errorMessage: describeMetaDeliveryFailure(update),
          providerResponse,
        },
      });
      if (logUpdate.count === 0) {
        return "ignored";
      }
      await tx.sendQueue.updateMany({
        where: {
          id: log.sendQueueId,
          organizationId: log.organizationId,
          status: QueueStatus.SENT,
        },
        data: {
          status: QueueStatus.FAILED,
          lastError: describeMetaDeliveryFailure(update),
          lastErrorCode: META_DELIVERY_FAILED,
          nextAttemptAt: null,
        },
      });
      return "updated";
    }

    const logUpdate = await tx.deliveryLog.updateMany({
      where: {
        id: log.id,
        status:
          update.status === "read"
            ? { in: [DeliveryStatus.SENT, DeliveryStatus.DELIVERED] }
            : DeliveryStatus.SENT,
      },
      data: {
        status:
          update.status === "read" ? DeliveryStatus.READ : DeliveryStatus.DELIVERED,
        providerResponse,
      },
    });
    if (logUpdate.count === 0) {
      return "ignored";
    }
    await tx.sendQueue.updateMany({
      where: {
        id: log.sendQueueId,
        organizationId: log.organizationId,
        status: QueueStatus.SENT,
      },
      data: { status: QueueStatus.DELIVERED },
    });
    return "updated";
  });
}
