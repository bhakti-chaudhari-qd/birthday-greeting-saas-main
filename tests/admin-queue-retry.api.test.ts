import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlatformAdminContext: vi.fn(),
  scheduleQueueRetry: vi.fn(),
  scheduleWorker: vi.fn(),
  createAuditEvent: vi.fn(),
  transaction: vi.fn(),
  tx: { sendQueue: {} },
}));

vi.mock("@/lib/auth/platform-admin-session", () => ({
  getPlatformAdminContext: mocks.getPlatformAdminContext,
}));

vi.mock("@/lib/queue/send", () => ({
  scheduleQueueRetry: mocks.scheduleQueueRetry,
}));

vi.mock("@/lib/queue/schedule-worker", () => ({
  scheduleMessageWorkerProcessing: mocks.scheduleWorker,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/admin/audit", () => ({
  PLATFORM_ADMIN_AUDIT_ACTIONS: {
    QUEUE_RETRY_SCHEDULED: "QUEUE_RETRY_SCHEDULED",
  },
  createPlatformAdminAuditEvent: mocks.createAuditEvent,
}));

import { POST } from "@/app/api/v1/admin/organizations/[id]/queue/[queueId]/retry/route";
import { QueueInvalidStateError } from "@/lib/queue/errors";

function retryRequest(body: object = {}) {
  return new Request(
    "http://localhost/api/v1/admin/organizations/org-a/queue/queue-1/retry",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

const routeContext = {
  params: Promise.resolve({ id: "org-a", queueId: "queue-1" }),
};

describe("platform admin queue retry API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx),
    );
    mocks.getPlatformAdminContext.mockResolvedValue({
      adminId: "admin-1",
      email: "admin@example.test",
      name: "Platform Admin",
    });
  });

  it("requires an authenticated platform admin", async () => {
    mocks.getPlatformAdminContext.mockResolvedValue(null);

    const response = await POST(retryRequest(), routeContext);

    expect(response.status).toBe(401);
    expect(mocks.scheduleQueueRetry).not.toHaveBeenCalled();
  });

  it("enforces route organization scoping and redacts the retry response", async () => {
    mocks.scheduleQueueRetry.mockResolvedValue({
      queueId: "queue-1",
      status: "scheduled",
      warning: undefined,
      queue: {
        contactMobile: "+919876543210",
        renderedBody: "Private rendered message",
        whatsappParameterValues: ["Private Name"],
        providerMessageId: "provider-id",
        providerResponse: { token: "secret" },
      },
    });

    const response = await POST(retryRequest(), routeContext);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.scheduleQueueRetry).toHaveBeenCalledWith(
      "org-a",
      "queue-1",
      { confirmAmbiguousRetry: undefined },
      mocks.tx,
    );
    expect(mocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAdminId: "admin-1",
        organizationId: "org-a",
        action: "QUEUE_RETRY_SCHEDULED",
        targetId: "queue-1",
      }),
      mocks.tx,
    );
    expect(mocks.scheduleWorker).toHaveBeenCalledOnce();
    expect(body).toEqual({
      data: {
        queueId: "queue-1",
        status: "scheduled",
        warning: null,
      },
    });
    expect(JSON.stringify(body)).not.toContain("+919876543210");
    expect(JSON.stringify(body)).not.toContain("Private");
    expect(JSON.stringify(body)).not.toContain("provider-id");
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("preserves explicit confirmation for ambiguous duplicate risk", async () => {
    mocks.scheduleQueueRetry.mockRejectedValueOnce(
      new QueueInvalidStateError(
        "Provider acceptance is unknown. Pass confirmAmbiguousRetry=true.",
      ),
    );

    const rejected = await POST(retryRequest(), routeContext);
    expect(rejected.status).toBe(400);
    expect(mocks.scheduleWorker).not.toHaveBeenCalled();

    mocks.scheduleQueueRetry.mockResolvedValueOnce({
      queueId: "queue-1",
      status: "scheduled",
      warning: "Retry may send a duplicate.",
      queue: {},
    });

    const confirmed = await POST(
      retryRequest({ confirmAmbiguousRetry: true }),
      routeContext,
    );
    const body = await confirmed.json();

    expect(confirmed.status).toBe(200);
    expect(mocks.scheduleQueueRetry).toHaveBeenLastCalledWith(
      "org-a",
      "queue-1",
      { confirmAmbiguousRetry: true },
      mocks.tx,
    );
    expect(body.data.warning).toBe("Retry may send a duplicate.");
    expect(mocks.scheduleWorker).toHaveBeenCalledOnce();
  });

  it("returns 404 for a queue outside the scoped organization", async () => {
    const { QueueNotFoundError } = await import("@/lib/queue/errors");
    mocks.scheduleQueueRetry.mockRejectedValue(new QueueNotFoundError());

    const response = await POST(retryRequest(), routeContext);

    expect(response.status).toBe(404);
    expect(mocks.scheduleQueueRetry).toHaveBeenCalledWith(
      "org-a",
      "queue-1",
      { confirmAmbiguousRetry: undefined },
      mocks.tx,
    );
    expect(mocks.createAuditEvent).not.toHaveBeenCalled();
    expect(mocks.scheduleWorker).not.toHaveBeenCalled();
  });
});
