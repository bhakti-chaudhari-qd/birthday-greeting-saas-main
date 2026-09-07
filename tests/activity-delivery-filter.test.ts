import { describe, expect, it } from "vitest";

import { buildDeliveryListWhere } from "@/lib/deliveries/list";
import { listDeliveriesQuerySchema } from "@/lib/validation/send";

describe("activity delivery outcome filters", () => {
  it("groups accepted and delivered outcomes under Submitted", () => {
    const query = listDeliveriesQuerySchema.parse({ outcome: "sent" });
    expect(buildDeliveryListWhere("org-1", query).status).toEqual({
      in: ["SENT", "DELIVERED", "READ"],
    });
  });

  it("keeps handset nondelivery separate from retryable queue failures", () => {
    const query = listDeliveriesQuerySchema.parse({
      outcome: "not_delivered",
    });
    expect(buildDeliveryListWhere("org-1", query).status).toBe("UNDELIVERED");
  });

  it("filters by greeting scheduled date when provided", () => {
    const query = listDeliveriesQuerySchema.parse({
      outcome: "sent",
      scheduledDate: "2026-07-22",
    });
    expect(buildDeliveryListWhere("org-1", query).sendQueue).toEqual({
      scheduledDate: new Date("2026-07-22T00:00:00.000Z"),
    });
  });
});
