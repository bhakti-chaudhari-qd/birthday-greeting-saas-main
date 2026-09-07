import { describe, expect, it } from "vitest";

import { buildUpcomingFromOccasionsDayView } from "@/lib/activity/upcoming";
import type { OccasionDayContact, OccasionsDayView } from "@/lib/queue/occasions-day-view";

function contact(
  overrides: Partial<OccasionDayContact> & Pick<OccasionDayContact, "id" | "name">,
): OccasionDayContact {
  return {
    mobile: "+919876543210",
    categoryId: "cat-1",
    categoryName: "VIP",
    smsAutomationEnabled: false,
    whatsappAutomationEnabled: false,
    emailAutomationEnabled: false,
    sendTimeLabel: "7:00 PM IST",
    smsTemplateName: null,
    messagePreview: null,
    smsMessageBody: null,
    deliveryStatus: "not_scheduled",
    sentAt: null,
    failureReason: null,
    whatsappTemplateName: null,
    whatsappMessagePreview: null,
    whatsappMessageBody: null,
    whatsappMediaAssetId: null,
    whatsappMediaFilename: null,
    whatsappMediaPreviewUrl: null,
    whatsappDeliveryStatus: "not_scheduled",
    whatsappSentAt: null,
    whatsappFailureReason: null,
    emailTemplateName: null,
    emailMessagePreview: null,
    emailMessageBody: null,
    emailDeliveryStatus: "not_scheduled",
    emailSentAt: null,
    emailFailureReason: null,
    ...overrides,
  };
}

function baseView(contacts: OccasionDayContact[]): OccasionsDayView {
  return {
    targetDate: "2026-07-22",
    timezone: "Asia/Kolkata",
    summary: {
      byOccasion: { "occasion-birthday": contacts.length },
      total: contacts.length,
    },
    sections: [
      {
        occasionId: "occasion-birthday",
        occasionName: "Birthday",
        label: "Birthday",
        count: contacts.length,
        automationEnabled: true,
        whatsappAutomationEnabled: true,
        emailAutomationEnabled: false,
        sendTimeLabel: "7:00 PM IST",
        contacts,
      },
    ],
  };
}

describe("buildUpcomingFromOccasionsDayView", () => {
  it("includes Will send contacts before queue generation", () => {
    const view = baseView([
      contact({
        id: "c1",
        name: "Ada",
        smsAutomationEnabled: true,
        smsTemplateName: "Birthday SMS",
        messagePreview: "Happy Birthday Ada!",
        smsMessageBody: "Happy Birthday Ada!",
      }),
    ]);

    const items = buildUpcomingFromOccasionsDayView(view);
    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe("will_send");
    expect(items[0]?.statusLabel).toBe("Scheduled");
    expect(items[0]?.sendTimeLabel).toBe("7:00 PM IST");
    expect(items[0]?.templateName).toBe("Birthday SMS");
  });

  it("uses per-contact WhatsApp template, not org-level section name", () => {
    const view = baseView([
      contact({
        id: "c1",
        name: "Ada",
        whatsappAutomationEnabled: true,
        whatsappTemplateName: "Video Birthday Greetings",
        whatsappMessagePreview: "Happy Birthday Ada with video!",
        whatsappMessageBody: "Happy Birthday Ada with video!",
        whatsappMediaAssetId: "media-1",
        whatsappMediaFilename: "greeting-birthday.webm",
        whatsappMediaPreviewUrl: "/api/v1/whatsapp-media/media-1",
      }),
    ]);

    const items = buildUpcomingFromOccasionsDayView(view);
    expect(items).toHaveLength(1);
    expect(items[0]?.channel).toBe("WHATSAPP");
    expect(items[0]?.templateName).toBe("Video Birthday Greetings");
    expect(items[0]?.messagePreview).toBe("Happy Birthday Ada with video!");
    expect(items[0]?.previewParts).toEqual([
      {
        channel: "WHATSAPP",
        templateName: "Video Birthday Greetings",
        messageBody: "Happy Birthday Ada with video!",
        mediaPreviewUrl: "/api/v1/whatsapp-media/media-1",
        mediaFilename: "greeting-birthday.webm",
      },
    ]);
  });

  it("lists both templates when SMS and WhatsApp are enabled", () => {
    const view = baseView([
      contact({
        id: "c1",
        name: "Ada",
        smsAutomationEnabled: true,
        whatsappAutomationEnabled: true,
        smsTemplateName: "SMS Birthday",
        smsMessageBody: "SMS text for Ada",
        messagePreview: "SMS text for Ada",
        whatsappTemplateName: "Video Birthday Greetings",
        whatsappMessageBody: "WhatsApp text for Ada",
        whatsappMessagePreview: "WhatsApp text for Ada",
      }),
    ]);

    const items = buildUpcomingFromOccasionsDayView(view);
    expect(items[0]?.channel).toBe("MULTI");
    expect(items[0]?.templateName).toBe(
      "SMS: SMS Birthday · WhatsApp: Video Birthday Greetings",
    );
    expect(items[0]?.previewParts).toHaveLength(2);
  });

  it("includes Email-only scheduled contacts", () => {
    const view = baseView([
      contact({
        id: "c1",
        name: "Ada",
        mobile: "",
        emailAutomationEnabled: true,
        emailTemplateName: "Birthday Email",
        emailMessagePreview: "Happy Birthday Ada by email!",
        emailMessageBody: "Happy Birthday Ada by email!",
      }),
    ]);

    const items = buildUpcomingFromOccasionsDayView(view);
    expect(items).toHaveLength(1);
    expect(items[0]?.channel).toBe("EMAIL");
    expect(items[0]?.templateName).toBe("Birthday Email");
    expect(items[0]?.messagePreview).toBe("Happy Birthday Ada by email!");
    expect(items[0]?.previewParts).toEqual([
      {
        channel: "EMAIL",
        templateName: "Birthday Email",
        messageBody: "Happy Birthday Ada by email!",
        mediaPreviewUrl: null,
        mediaFilename: null,
      },
    ]);
  });

  it("includes pending/sending and skips submitted or not set up", () => {
    const view = baseView([
      contact({
        id: "c1",
        name: "Pending Person",
        mobile: "+919876543211",
        smsAutomationEnabled: true,
        smsTemplateName: "Birthday SMS",
        messagePreview: "Hi",
        smsMessageBody: "Hi",
        deliveryStatus: "pending",
      }),
      contact({
        id: "c2",
        name: "Already Sent",
        mobile: "+919876543212",
        smsAutomationEnabled: true,
        smsTemplateName: "Birthday SMS",
        messagePreview: "Hi",
        smsMessageBody: "Hi",
        deliveryStatus: "sent",
        sentAt: "2026-07-22T13:30:00.000Z",
      }),
      contact({
        id: "c3",
        name: "No Route",
        mobile: "+919876543213",
        categoryId: "cat-2",
        categoryName: "Friend",
      }),
    ]);

    const items = buildUpcomingFromOccasionsDayView(view);
    expect(items.map((item) => item.contactName)).toEqual(["Pending Person"]);
    expect(items[0]?.status).toBe("pending");
  });
});
