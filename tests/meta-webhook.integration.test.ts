import { DeliveryStatus, QueueStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  META_DELIVERY_FAILED,
  applyMetaStatusUpdate,
} from "@/lib/deliveries/meta-webhook";
import {
  cleanupOrganization,
  createSendQueueItem,
  createTestOrganization,
  testPrisma,
  uniqueSuffix,
} from "./helpers";

let databaseAvailable = false;
let organizationId = "";
let contactId = "";
let templateId = "";

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  try {
    const organization = await createTestOrganization(`meta-webhook-${uniqueSuffix()}`);
    organizationId = organization.id;
    contactId = organization.contacts[0]!.id;
    templateId = organization.messageTemplates[0]!.id;
    databaseAvailable = true;
  } catch {
    databaseAvailable = false;
  }
});

afterAll(async () => {
  if (databaseAvailable) {
    await cleanupOrganization(organizationId);
  }
  await testPrisma.$disconnect();
});

/** A message the provider accepted: queue SENT with one SENT delivery log. */
async function createSubmittedMessage() {
  const messageId = `wamid.${uniqueSuffix()}`;
  const queue = await createSendQueueItem(
    organizationId,
    contactId,
    templateId,
    `meta-webhook-${uniqueSuffix()}`,
  );
  await testPrisma.sendQueue.update({
    where: { id: queue.id },
    data: { status: QueueStatus.SENT, sentAt: new Date(), attemptCount: 1 },
  });
  const log = await testPrisma.deliveryLog.create({
    data: {
      organizationId,
      sendQueueId: queue.id,
      attemptNumber: 1,
      status: DeliveryStatus.SENT,
      providerMessageId: messageId,
      providerResponse: { provider: "META" },
    },
  });
  return { messageId, queueId: queue.id, logId: log.id };
}

async function statuses(queueId: string, logId: string) {
  const [queue, log] = await Promise.all([
    testPrisma.sendQueue.findUniqueOrThrow({ where: { id: queueId } }),
    testPrisma.deliveryLog.findUniqueOrThrow({ where: { id: logId } }),
  ]);
  return { queue, log };
}

describe("applyMetaStatusUpdate", () => {
  it("marks a submitted message delivered, then read", async ({ skip }) => {
    if (!databaseAvailable) skip();
    const message = await createSubmittedMessage();

    expect(
      await applyMetaStatusUpdate({
        messageId: message.messageId,
        status: "delivered",
        errorCode: null,
        errorMessage: null,
      }),
    ).toBe("updated");
    let state = await statuses(message.queueId, message.logId);
    expect(state.queue.status).toBe(QueueStatus.DELIVERED);
    expect(state.log.status).toBe(DeliveryStatus.DELIVERED);

    await applyMetaStatusUpdate({
      messageId: message.messageId,
      status: "read",
      errorCode: null,
      errorMessage: null,
    });
    state = await statuses(message.queueId, message.logId);
    expect(state.queue.status).toBe(QueueStatus.DELIVERED);
    expect(state.log.status).toBe(DeliveryStatus.READ);
  });

  it("marks a submitted message failed with Meta's reason", async ({ skip }) => {
    if (!databaseAvailable) skip();
    const message = await createSubmittedMessage();

    expect(
      await applyMetaStatusUpdate({
        messageId: message.messageId,
        status: "failed",
        errorCode: "131049",
        errorMessage: "Not delivered to maintain healthy ecosystem engagement.",
      }),
    ).toBe("updated");

    const state = await statuses(message.queueId, message.logId);
    expect(state.queue.status).toBe(QueueStatus.FAILED);
    expect(state.queue.lastErrorCode).toBe(META_DELIVERY_FAILED);
    expect(state.queue.lastError).toContain("healthy ecosystem engagement");
    expect(state.queue.lastError).toContain("131049");
    expect(state.log.status).toBe(DeliveryStatus.UNDELIVERED);
  });

  it("never downgrades a delivered message when a late failure arrives", async ({ skip }) => {
    if (!databaseAvailable) skip();
    const message = await createSubmittedMessage();
    await applyMetaStatusUpdate({
      messageId: message.messageId,
      status: "delivered",
      errorCode: null,
      errorMessage: null,
    });

    expect(
      await applyMetaStatusUpdate({
        messageId: message.messageId,
        status: "failed",
        errorCode: "131000",
        errorMessage: "Something went wrong",
      }),
    ).toBe("ignored");
    expect((await statuses(message.queueId, message.logId)).queue.status).toBe(
      QueueStatus.DELIVERED,
    );
  });

  it("reports an update for a message this app never sent", async ({ skip }) => {
    if (!databaseAvailable) skip();

    expect(
      await applyMetaStatusUpdate({
        messageId: "wamid.not-ours",
        status: "delivered",
        errorCode: null,
        errorMessage: null,
      }),
    ).toBe("unknown_message");
  });
});
