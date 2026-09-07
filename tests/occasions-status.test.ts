import { describe, expect, it } from "vitest";

import {
  channelHumanStatus,
  overallHumanStatus,
} from "@/lib/queue/occasions-status";

describe("occasions overall status", () => {
  it("maps queued channel states like Outbox", () => {
    expect(channelHumanStatus(true, "pending")).toBe("pending");
    expect(channelHumanStatus(true, "sending")).toBe("sending");
    expect(channelHumanStatus(true, "sent")).toBe("sent");
    expect(channelHumanStatus(true, "not_scheduled")).toBe("will_send");
    expect(channelHumanStatus(false, "sent")).toBe("not_set_up");
  });

  it("shows Sent when WhatsApp already sent even if SMS is still will-send", () => {
    expect(
      overallHumanStatus(true, "not_scheduled", true, "sent"),
    ).toBe("sent");
  });

  it("shows Sent when only WhatsApp automation is on and sent", () => {
    expect(
      overallHumanStatus(false, "not_scheduled", true, "sent"),
    ).toBe("sent");
  });

  it("prefers pending over sent when another channel is still queued", () => {
    expect(overallHumanStatus(true, "pending", true, "sent")).toBe("pending");
  });

  it("shows will send when nothing is queued yet", () => {
    expect(
      overallHumanStatus(true, "not_scheduled", true, "not_scheduled"),
    ).toBe("will_send");
  });
});