import { afterEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.fn();
const runMessageWorkerMock = vi.fn();

vi.mock("next/server", () => ({
  after: (task: unknown) => afterMock(task),
}));

vi.mock("@/lib/queue/worker", () => ({
  runMessageWorker: () => runMessageWorkerMock(),
}));

describe("scheduleMessageWorkerProcessing", () => {
  afterEach(() => {
    afterMock.mockReset();
    runMessageWorkerMock.mockReset();
  });

  it("registers runMessageWorker with next/server after()", async () => {
    runMessageWorkerMock.mockResolvedValue({ claimed: 0 });
    afterMock.mockImplementation((task: () => unknown) => {
      void task();
    });

    const { scheduleMessageWorkerProcessing } = await import(
      "@/lib/queue/schedule-worker"
    );

    scheduleMessageWorkerProcessing();

    expect(afterMock).toHaveBeenCalledOnce();
    expect(runMessageWorkerMock).toHaveBeenCalledOnce();
  });

  it("no-ops when after() is outside a request scope", async () => {
    afterMock.mockImplementation(() => {
      throw new Error(
        "`after` was called outside a request scope. Read more: https://nextjs.org/docs/messages/next-dynamic-api-wrong-context",
      );
    });

    // Fresh module not needed; same import is fine with reset mocks
    const { scheduleMessageWorkerProcessing } = await import(
      "@/lib/queue/schedule-worker"
    );

    expect(() => scheduleMessageWorkerProcessing()).not.toThrow();
    expect(runMessageWorkerMock).not.toHaveBeenCalled();
  });
});
