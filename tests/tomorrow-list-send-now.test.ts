import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  findOrg: vi.fn(),
  updateOrg: vi.fn(),
  countEntries: vi.fn(),
  countLinks: vi.fn(),
  createLink: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findUniqueOrThrow: mocks.findOrg, update: mocks.updateOrg },
    contactOccasionDate: { count: mocks.countEntries },
    tomorrowListLink: { count: mocks.countLinks, create: mocks.createLink },
  },
}));

vi.mock("@/lib/tomorrow-list/platform-config", () => ({
  loadTomorrowListConfig: mocks.loadConfig,
  getPlatformTomorrowListSettings: vi.fn(),
}));

vi.mock("@/lib/messaging/providers/whatsapp/meta-whatsapp-provider", () => ({
  createMetaWhatsAppProvider: () => ({ send: mocks.send }),
}));

import { sendTomorrowListNow } from "@/lib/tomorrow-list/service";

// 16 Nov 2026, 11:30 IST -> the list is for 17 Nov.
const NOW = new Date("2026-11-16T06:00:00Z");

const org = {
  id: "org1",
  name: "Birthday Greeting",
  tomorrowListAllowedByAdmin: true,
  tomorrowListRecipients: [{ mobile: "9881714760" }, { mobile: "9000000001" }],
  users: [{ whatsappNumber: "9999999999", mobile: "9999999999" }],
};

describe("sendTomorrowListNow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfig.mockResolvedValue({
      accessToken: "t",
      phoneNumberId: "1",
      apiVersion: "v21.0",
      templateName: "tomorrow_list_v2",
      language: "en",
      sendHour: 20,
    });
    mocks.findOrg.mockResolvedValue(org);
    mocks.countEntries.mockResolvedValue(3);
    mocks.countLinks.mockResolvedValue(0);
    mocks.createLink.mockResolvedValue({});
    mocks.updateOrg.mockResolvedValue({});
  });

  it("says so when the platform has not switched it on", async () => {
    mocks.loadConfig.mockResolvedValue(null);
    await expect(sendTomorrowListNow("org1", NOW)).resolves.toEqual({
      status: "not_configured",
    });
  });

  it("says so when nobody has an occasion tomorrow, without sending", async () => {
    mocks.countEntries.mockResolvedValue(0);
    await expect(sendTomorrowListNow("org1", NOW)).resolves.toEqual({
      status: "nobody",
      forDate: "2026-11-17",
    });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.createLink).not.toHaveBeenCalled();
  });

  it("reports each number, with Meta's error for refused ones", async () => {
    mocks.send
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("Template does not exist"));

    const result = await sendTomorrowListNow("org1", NOW);

    expect(result).toEqual({
      status: "sent",
      forDate: "2026-11-17",
      total: 3,
      results: [
        { mobile: "9881714760", ok: true, error: null },
        { mobile: "9000000001", ok: false, error: "Template does not exist" },
      ],
    });
    // One fresh link, the day marked handled, the token in the button.
    expect(mocks.createLink).toHaveBeenCalledTimes(1);
    expect(mocks.updateOrg).toHaveBeenCalledWith({
      where: { id: "org1" },
      data: { tomorrowListLastSentFor: new Date("2026-11-17T00:00:00Z") },
    });
    const sent = mocks.send.mock.calls[0]![0];
    expect(sent.templateName).toBe("tomorrow_list_v2");
    expect(sent.parameterValues).toEqual(["Birthday Greeting", "17 Nov 2026", "3"]);
    expect(sent.buttonUrlSuffix).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("stops after the daily link limit", async () => {
    mocks.countLinks.mockResolvedValue(5);
    await expect(sendTomorrowListNow("org1", NOW)).resolves.toEqual({
      status: "limit_reached",
      limit: 5,
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("refuses when the platform team turned it off for this client", async () => {
    mocks.findOrg.mockResolvedValue({ ...org, tomorrowListAllowedByAdmin: false });
    await expect(sendTomorrowListNow("org1", NOW)).resolves.toEqual({
      status: "turned_off_by_admin",
    });
  });
});
