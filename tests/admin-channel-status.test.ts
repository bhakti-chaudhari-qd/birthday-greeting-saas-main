import { describe, expect, it } from "vitest";

import { buildLiveReadinessChecklist } from "@/lib/abuse/live-readiness";
import { summarizeMetaWhatsAppHealth } from "@/lib/admin/channel-status";

describe("summarizeMetaWhatsAppHealth", () => {
  it("reports the payment block and ignores calling errors on a healthy number", () => {
    const health = summarizeMetaWhatsAppHealth({
      display_phone_number: "+91 99333 30110",
      verified_name: "Quickly Design",
      status: "CONNECTED",
      name_status: "APPROVED",
      quality_rating: "GREEN",
      account_mode: "LIVE",
      health_status: {
        can_send_message: "BLOCKED",
        entities: [
          {
            entity_type: "PHONE_NUMBER",
            can_send_message: "AVAILABLE",
            errors: [
              {
                error_code: 138024,
                error_description:
                  "WhatsApp Business calling cannot use SIP because it is not enabled",
              },
            ],
          },
          {
            entity_type: "WABA",
            can_send_message: "BLOCKED",
            errors: [
              {
                error_code: 141006,
                error_description:
                  "There is an error with the payment method. This will block business initiated conversations.",
                possible_solution: "Please add a new payment method to the account.",
              },
            ],
          },
          { entity_type: "BUSINESS", can_send_message: "AVAILABLE" },
        ],
      },
    });

    expect(health).toMatchObject({
      displayPhoneNumber: "+91 99333 30110",
      numberStatus: "CONNECTED",
      accountMode: "LIVE",
      canSendMessage: "BLOCKED",
    });
    expect(health.issues).toEqual([
      "There is an error with the payment method. This will block business initiated conversations. Please add a new payment method to the account.",
    ]);
  });

  it("returns no issues for a number that can send", () => {
    const health = summarizeMetaWhatsAppHealth({
      status: "CONNECTED",
      health_status: {
        can_send_message: "AVAILABLE",
        entities: [{ entity_type: "WABA", can_send_message: "AVAILABLE" }],
      },
    });

    expect(health.canSendMessage).toBe("AVAILABLE");
    expect(health.issues).toEqual([]);
  });
});

describe("buildLiveReadinessChecklist", () => {
  const base = {
    paidPlanActive: false,
    liveChannelsApproved: false,
    liveProviderDone: false,
    smsTemplateCount: 0,
    smsTemplatesNeedingSetup: 0,
  };

  it("asks for nothing when a platform route already lets the client send", () => {
    expect(buildLiveReadinessChecklist({ ...base, hasPlatformRoute: true })).toEqual([]);
  });

  it("still lists DLT setup when SMS templates need it", () => {
    const checklist = buildLiveReadinessChecklist({
      ...base,
      hasPlatformRoute: true,
      smsTemplateCount: 2,
      smsTemplatesNeedingSetup: 1,
    });

    expect(checklist.map((item) => item.id)).toEqual(["dlt_templates"]);
    expect(checklist[0]?.done).toBe(false);
  });

  it("lists plan, DLT and gateway steps when there is no platform route", () => {
    const checklist = buildLiveReadinessChecklist({ ...base, hasPlatformRoute: false });

    expect(checklist.map((item) => item.id)).toEqual([
      "paid_plan",
      "dlt_templates",
      "live_provider",
    ]);
  });
});
