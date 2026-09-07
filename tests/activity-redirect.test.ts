import { describe, expect, it } from "vitest";

import {
  activityTabForDeliveryStatus,
  activityTabForQueueStatus,
  buildActivityRedirect,
} from "@/lib/activity/legacy-redirect";

describe("legacy activity redirects", () => {
  it("maps old queue and delivery statuses to consolidated tabs", () => {
    expect(activityTabForQueueStatus("PENDING")).toBe("upcoming");
    expect(activityTabForQueueStatus("SENDING")).toBe("upcoming");
    expect(activityTabForQueueStatus("FAILED")).toBe("failed");
    expect(activityTabForQueueStatus("SENT")).toBe("sent");
    expect(activityTabForDeliveryStatus("QUEUED")).toBe("upcoming");
    expect(activityTabForDeliveryStatus("UNDELIVERED")).toBe("failed");
    expect(activityTabForDeliveryStatus("DELIVERED")).toBe("sent");
  });

  it("preserves compatible filters", () => {
    expect(
      buildActivityRedirect("failed", {
        search: "Alex",
        channel: "WHATSAPP",
        status: "FAILED",
      }),
    ).toBe("/dashboard/activity?tab=failed&search=Alex&channel=WHATSAPP");
  });
});
