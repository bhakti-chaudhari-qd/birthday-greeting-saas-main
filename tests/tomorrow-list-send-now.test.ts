import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  findOrg: vi.fn(),
  findOrgs: vi.fn(),
  updateOrg: vi.fn(),
  updateManyOrg: vi.fn(),
  deleteLinks: vi.fn(),
  transaction: vi.fn(),
  deleteRecipients: vi.fn(),
  createRecipients: vi.fn(),
  countEntries: vi.fn(),
  countLinks: vi.fn(),
  createLink: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    tomorrowListRecipient: {
      deleteMany: mocks.deleteRecipients,
      createMany: mocks.createRecipients,
    },
    organization: {
      findUniqueOrThrow: mocks.findOrg,
      findMany: mocks.findOrgs,
      update: mocks.updateOrg,
      updateMany: mocks.updateManyOrg,
    },
    contactOccasionDate: { count: mocks.countEntries },
    tomorrowListLink: {
      count: mocks.countLinks,
      create: mocks.createLink,
      deleteMany: mocks.deleteLinks,
    },
  },
}));

vi.mock("@/lib/tomorrow-list/platform-config", () => ({
  loadTomorrowListConfig: mocks.loadConfig,
  getPlatformTomorrowListSettings: vi.fn().mockResolvedValue({ sendHour: 20 }),
}));

vi.mock("@/lib/messaging/providers/whatsapp/meta-whatsapp-provider", () => ({
  createMetaWhatsAppProvider: () => ({ send: mocks.send }),
}));

import {
  runTomorrowLists,
  sendTomorrowListNow,
  updateTomorrowListSettings,
} from "@/lib/tomorrow-list/service";

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
    // One fresh link; the scheduled send is left alone.
    expect(mocks.createLink).toHaveBeenCalledTimes(1);
    expect(mocks.updateOrg).not.toHaveBeenCalled();
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

const DAY = new Date("2026-11-17T00:00:00Z");

function scheduledOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: "org1",
    name: "Birthday Greeting",
    tomorrowListAttempts: 0,
    tomorrowListAttemptsFor: null,
    tomorrowListRecipients: [{ mobile: "9881714760" }],
    users: [],
    ...overrides,
  };
}

function savedResult() {
  const call = mocks.updateOrg.mock.calls.at(-1)![0];
  return call.data as {
    tomorrowListLastResult: { status: string; attempt: number };
    tomorrowListLastSentFor?: Date;
  };
}

describe("runTomorrowLists retries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfig.mockResolvedValue({
      accessToken: "t",
      phoneNumberId: "1",
      apiVersion: "v21.0",
      templateName: "tomorrow_list_v2",
      language: "en",
      sendHour: 9,
    });
    mocks.countEntries.mockResolvedValue(2);
    mocks.createLink.mockResolvedValue({});
    mocks.updateOrg.mockResolvedValue({});
    mocks.deleteLinks.mockResolvedValue({ count: 0 });
    mocks.updateManyOrg.mockResolvedValue({ count: 1 });
  });

  it("marks the day handled when WhatsApp accepts the send", async () => {
    mocks.findOrgs.mockResolvedValue([scheduledOrg()]);
    mocks.send.mockResolvedValue({});

    await runTomorrowLists(NOW);

    expect(savedResult().tomorrowListLastSentFor).toEqual(DAY);
    expect(savedResult().tomorrowListLastResult).toMatchObject({
      status: "sent",
      attempt: 1,
    });
  });

  it("leaves the day open after a refused send, so it is retried", async () => {
    mocks.findOrgs.mockResolvedValue([scheduledOrg()]);
    mocks.send.mockRejectedValue(new Error("Template paused"));

    await runTomorrowLists(NOW);

    expect(savedResult().tomorrowListLastSentFor).toBeUndefined();
    expect(savedResult().tomorrowListLastResult).toMatchObject({
      status: "failed",
      attempt: 1,
    });
  });

  it("counts the next attempt for the same day and claims it with compare-and-set", async () => {
    mocks.findOrgs.mockResolvedValue([
      scheduledOrg({ tomorrowListAttempts: 2, tomorrowListAttemptsFor: DAY }),
    ]);
    mocks.send.mockRejectedValue(new Error("still failing"));

    await runTomorrowLists(NOW);

    expect(mocks.updateManyOrg).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tomorrowListAttempts: 2,
          tomorrowListAttemptsFor: DAY,
        }),
        data: { tomorrowListAttemptsFor: DAY, tomorrowListAttempts: 3 },
      }),
    );
    expect(savedResult().tomorrowListLastResult).toMatchObject({ attempt: 3 });
  });

  it("skips an attempt another tick already claimed", async () => {
    mocks.findOrgs.mockResolvedValue([scheduledOrg()]);
    mocks.updateManyOrg.mockResolvedValue({ count: 0 });

    await runTomorrowLists(NOW);

    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.updateOrg).not.toHaveBeenCalled();
  });

  it("marks the day handled without sending when nobody is on the list", async () => {
    mocks.findOrgs.mockResolvedValue([scheduledOrg()]);
    mocks.countEntries.mockResolvedValue(0);

    await runTomorrowLists(NOW);

    expect(mocks.send).not.toHaveBeenCalled();
    expect(savedResult().tomorrowListLastSentFor).toEqual(DAY);
    expect(savedResult().tomorrowListLastResult).toMatchObject({ status: "nobody" });
  });
});

describe("updateTomorrowListSettings re-arms the scheduled send", () => {
  const settingsRow = {
    tomorrowListEnabled: true,
    tomorrowListAllowedByAdmin: true,
    tomorrowListSendHour: 12,
    tomorrowListSendMinute: 47,
    tomorrowListLastResult: null,
    tomorrowListRecipients: [],
    users: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockResolvedValue([]);
    mocks.updateOrg.mockReturnValue({});
  });

  function savedData() {
    return mocks.updateOrg.mock.calls[0]![0].data as Record<string, unknown>;
  }

  it("resets the attempt count when the send time changes", async () => {
    mocks.findOrg
      .mockResolvedValueOnce({ tomorrowListSendHour: 11, tomorrowListSendMinute: 24 })
      .mockResolvedValueOnce(settingsRow);

    await updateTomorrowListSettings("org1", {
      enabled: true,
      recipients: [],
      sendHour: 12,
      sendMinute: 47,
    });

    expect(savedData()).toMatchObject({
      tomorrowListSendHour: 12,
      tomorrowListSendMinute: 47,
      tomorrowListAttempts: 0,
      tomorrowListAttemptsFor: null,
    });
    // The handled mark is never touched, so a delivered list is not resent.
    expect(savedData()).not.toHaveProperty("tomorrowListLastSentFor");
  });

  it("keeps the attempt count when the time is unchanged", async () => {
    mocks.findOrg
      .mockResolvedValueOnce({ tomorrowListSendHour: 12, tomorrowListSendMinute: 47 })
      .mockResolvedValueOnce(settingsRow);

    await updateTomorrowListSettings("org1", {
      enabled: true,
      recipients: [],
      sendHour: 12,
      sendMinute: 47,
    });

    expect(savedData()).not.toHaveProperty("tomorrowListAttempts");
  });

  describe("tomorrow already marked handled", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW); // 16 Nov -> tomorrow is 17 Nov
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const changeTime = () =>
      updateTomorrowListSettings("org1", {
        enabled: true,
        recipients: [],
        sendHour: 13,
        sendMinute: 5,
      });

    it("re-arms a day marked handled with no recorded result", async () => {
      mocks.findOrg
        .mockResolvedValueOnce({
          tomorrowListSendHour: 13,
          tomorrowListSendMinute: 0,
          tomorrowListLastSentFor: DAY,
          tomorrowListLastResult: null,
        })
        .mockResolvedValueOnce(settingsRow);

      await changeTime();

      expect(savedData()).toMatchObject({ tomorrowListLastSentFor: null });
    });

    it("re-arms a day whose scheduled send was refused", async () => {
      mocks.findOrg
        .mockResolvedValueOnce({
          tomorrowListSendHour: 13,
          tomorrowListSendMinute: 0,
          tomorrowListLastSentFor: DAY,
          tomorrowListLastResult: { forDate: "2026-11-17", status: "failed" },
        })
        .mockResolvedValueOnce(settingsRow);

      await changeTime();

      expect(savedData()).toMatchObject({ tomorrowListLastSentFor: null });
    });

    it("never re-arms a day WhatsApp already accepted", async () => {
      mocks.findOrg
        .mockResolvedValueOnce({
          tomorrowListSendHour: 13,
          tomorrowListSendMinute: 0,
          tomorrowListLastSentFor: DAY,
          tomorrowListLastResult: { forDate: "2026-11-17", status: "sent" },
        })
        .mockResolvedValueOnce(settingsRow);

      await changeTime();

      expect(savedData()).not.toHaveProperty("tomorrowListLastSentFor");
    });

    it("tells the page when tomorrow is handled with no recorded result", async () => {
      mocks.findOrg.mockResolvedValueOnce({
        ...settingsRow,
        tomorrowListLastSentFor: DAY,
      });

      const { getTomorrowListSettings } = await import("@/lib/tomorrow-list/service");
      const settings = await getTomorrowListSettings("org1");

      expect(settings.handledWithoutResultFor).toBe("2026-11-17");
    });
  });
});
