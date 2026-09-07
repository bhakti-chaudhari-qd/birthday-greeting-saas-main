import { describe, expect, it } from "vitest";

import {
  MANUAL_SEND_API_BATCH_SIZE,
  chunkIds,
  getManualSendBatchCount,
} from "@/lib/queue/manual-send-batches";

describe("manual send batch helpers", () => {
  it("chunks ids into API-sized batches", () => {
    const ids = Array.from({ length: 120 }, (_, i) => `c${i}`);
    const chunks = chunkIds(ids, MANUAL_SEND_API_BATCH_SIZE);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(50);
    expect(chunks[1]).toHaveLength(50);
    expect(chunks[2]).toHaveLength(20);
    expect(chunks.flat()).toEqual(ids);
  });

  it("counts batches for recipient totals", () => {
    expect(getManualSendBatchCount(0)).toBe(0);
    expect(getManualSendBatchCount(1)).toBe(1);
    expect(getManualSendBatchCount(50)).toBe(1);
    expect(getManualSendBatchCount(51)).toBe(2);
    expect(getManualSendBatchCount(100)).toBe(2);
    expect(getManualSendBatchCount(500)).toBe(10);
  });
});
