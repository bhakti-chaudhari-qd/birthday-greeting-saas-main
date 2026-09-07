import { describe, expect, it } from "vitest";

import {
  DELIVERY_REPORT_FILTERS,
  QUEUE_REPORT_FILTERS,
  getCustomerDeliveryStatusHint,
  getCustomerDeliveryStatusLabel,
  getCustomerQueueStatusLabel,
  getOccasionStatusLabel,
} from "@/lib/ui/customer-labels";
import {
  deliveryStatusTone,
  queueStatusTone,
} from "@/components/ui/feedback";

describe("activity customer status labels", () => {
  it("maps delivery statuses to customer labels", () => {
    expect(getCustomerDeliveryStatusLabel("SENT")).toBe("Submitted");
    expect(getCustomerDeliveryStatusLabel("DELIVERED")).toBe("Delivered");
    expect(getCustomerDeliveryStatusLabel("FAILED")).toBe("Failed");
    expect(getCustomerDeliveryStatusLabel("QUEUED")).toBe("Sending");
    expect(getCustomerDeliveryStatusLabel("UNDELIVERED")).toBe("Not delivered");
  });

  it("maps queue statuses to customer labels", () => {
    expect(getCustomerQueueStatusLabel("PENDING")).toBe("Pending");
    expect(getCustomerQueueStatusLabel("FAILED")).toBe("Failed");
    expect(getCustomerQueueStatusLabel("SENT")).toBe("Submitted");
    expect(getCustomerQueueStatusLabel("SENDING")).toBe("Sending");
  });

  it("maps occasion statuses to the same labels as Outbox", () => {
    expect(getOccasionStatusLabel("pending")).toBe("Pending");
    expect(getOccasionStatusLabel("sending")).toBe("Sending");
    expect(getOccasionStatusLabel("sent")).toBe("Submitted");
    expect(getOccasionStatusLabel("failed")).toBe("Failed");
    expect(getOccasionStatusLabel("will_send")).toBe("Scheduled");
    expect(getOccasionStatusLabel("not_scheduled")).toBe("Scheduled");
  });

  it("exposes Submitted/Failed/Pending report filter presets", () => {
    expect(DELIVERY_REPORT_FILTERS.map((item) => item.label)).toEqual([
      "All",
      "Submitted",
      "Failed",
    ]);
    expect(QUEUE_REPORT_FILTERS.map((item) => item.label)).toEqual([
      "All",
      "Pending",
      "Failed",
      "Submitted",
    ]);
    expect(QUEUE_REPORT_FILTERS.find((item) => item.label === "Pending")?.value).toBe(
      "PENDING",
    );
  });

  it("keeps a hint that Submitted is provider-accepted, not handset-delivered", () => {
    expect(getCustomerDeliveryStatusHint("SENT")).toMatch(/carrier accepted/i);
    expect(getCustomerDeliveryStatusHint("SENT")).toMatch(/does not guarantee/i);
  });

  it("assigns badge tones for report statuses", () => {
    expect(deliveryStatusTone("SENT")).toBe("success");
    expect(deliveryStatusTone("FAILED")).toBe("danger");
    expect(queueStatusTone("PENDING")).toBe("warning");
    expect(queueStatusTone("SENT")).toBe("success");
    expect(queueStatusTone("FAILED")).toBe("danger");
  });
});
