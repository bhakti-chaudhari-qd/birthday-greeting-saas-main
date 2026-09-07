import { Channel, QueueStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  findQueue: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    sendQueue: { findMany: dbMocks.findQueue },
  },
}));

import {
  listFailedQueueDiagnosticsForPlatformAdmin,
  safeFailureReason,
} from "@/lib/admin/failed-queue";

describe("platform admin failed queue diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries by organization and returns only safe diagnostic fields", async () => {
    dbMocks.findQueue.mockResolvedValue([
      {
        id: "queue-1",
        organizationId: "org-a",
        contactId: "contact-1",
        renderedBody: "Private birthday message",
        whatsappParameterValues: ["Private Name"],
        status: QueueStatus.FAILED,
        channel: Channel.SMS,
        attemptCount: 2,
        lastError: "token=secret contact@example.test +919876543210",
        lastErrorCode: "PROVIDER_HTTP_5XX",
        createdAt: new Date("2026-07-20T08:00:00.000Z"),
        updatedAt: new Date("2026-07-21T08:00:00.000Z"),
        deliveryLogs: [
          {
            providerMessageId: "provider-secret-id",
            providerResponse: { token: "credential" },
          },
        ],
      },
    ]);

    const result =
      await listFailedQueueDiagnosticsForPlatformAdmin("org-a");

    expect(dbMocks.findQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org-a",
          status: QueueStatus.FAILED,
        },
        select: {
          id: true,
          channel: true,
          status: true,
          attemptCount: true,
          lastErrorCode: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );
    expect(result).toEqual([
      {
        id: "queue-1",
        channel: Channel.SMS,
        status: QueueStatus.FAILED,
        attemptCount: 2,
        failureReason: "The provider was temporarily unavailable.",
        createdAt: "2026-07-20T08:00:00.000Z",
        updatedAt: "2026-07-21T08:00:00.000Z",
      },
    ]);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Private");
    expect(serialized).not.toContain("contact@example.test");
    expect(serialized).not.toContain("+919876543210");
    expect(serialized).not.toContain("provider-secret-id");
    expect(serialized).not.toContain("credential");
  });

  it("uses reviewed failure summaries without exposing raw error codes", async () => {
    dbMocks.findQueue.mockResolvedValue([
      {
        id: "ambiguous",
        status: QueueStatus.FAILED,
        channel: Channel.WHATSAPP,
        attemptCount: 1,
        lastErrorCode: "AMBIGUOUS_PROVIDER_OUTCOME",
        createdAt: new Date("2026-07-20T08:00:00.000Z"),
        updatedAt: new Date("2026-07-21T08:00:00.000Z"),
      },
      {
        id: "exhausted",
        status: QueueStatus.FAILED,
        channel: Channel.EMAIL,
        attemptCount: 5,
        lastErrorCode: "UNREVIEWED_SECRET_DETAIL",
        createdAt: new Date("2026-07-20T08:00:00.000Z"),
        updatedAt: new Date("2026-07-21T08:00:00.000Z"),
      },
    ]);

    const result =
      await listFailedQueueDiagnosticsForPlatformAdmin("org-a");

    expect(result[0]).toEqual({
      id: "ambiguous",
      channel: Channel.WHATSAPP,
      status: QueueStatus.FAILED,
      attemptCount: 1,
      failureReason:
        "Provider acceptance is unknown. The provider may already have accepted this message. Retrying may send a duplicate.",
      createdAt: "2026-07-20T08:00:00.000Z",
      updatedAt: "2026-07-21T08:00:00.000Z",
    });
    expect(result[1]).toMatchObject({
      failureReason: "Message delivery failed.",
    });
    expect(JSON.stringify(result)).not.toContain("AMBIGUOUS_PROVIDER_OUTCOME");
    expect(JSON.stringify(result)).not.toContain("UNREVIEWED_SECRET_DETAIL");
    expect(safeFailureReason("UNREVIEWED_SECRET_DETAIL")).toBe(
      "Message delivery failed.",
    );
  });
});
