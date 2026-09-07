import { describe, expect, it } from "vitest";

import {
  applyAllCategoryPatch,
  buildAllCategoryRow,
  type CategoryAutomationDisplayRow,
} from "@/lib/automation/all-category-row";

function baseRow(
  categoryId: string,
  name: string,
  contactCount: number,
  overrides: Partial<CategoryAutomationDisplayRow> = {},
): CategoryAutomationDisplayRow {
  return {
    id: null,
    categoryId,
    categoryName: name,
    contactCount,
    sendHour: 6,
    sendMinute: 0,
    smsEnabled: false,
    smsTemplateId: null,
    whatsappEnabled: false,
    whatsappTemplateId: null,
    emailEnabled: false,
    emailTemplateId: null,
    callEnabled: false,
    ...overrides,
  };
}

describe("Automatic greetings All category", () => {
  it("sums contacts and mirrors shared settings when groups match", () => {
    const rows = [
      baseRow("vip", "VIP", 10, {
        smsEnabled: true,
        smsTemplateId: "tpl",
        sendHour: 20,
      }),
      baseRow("friend", "Friend", 6, {
        smsEnabled: true,
        smsTemplateId: "tpl",
        sendHour: 20,
      }),
    ];

    const all = buildAllCategoryRow(rows);
    expect(all.categoryName).toBe("All");
    expect(all.contactCount).toBe(16);
    expect(all.smsEnabled).toBe(true);
    expect(all.smsTemplateId).toBe("tpl");
    expect(all.sendHour).toBe(20);
  });

  it("stays unset when groups differ so All can reset them together", () => {
    const rows = [
      baseRow("vip", "VIP", 10, {
        smsEnabled: true,
        smsTemplateId: "tpl-a",
      }),
      baseRow("friend", "Friend", 6, {
        smsEnabled: true,
        smsTemplateId: "tpl-b",
      }),
    ];

    const all = buildAllCategoryRow(rows);
    expect(all.smsEnabled).toBe(false);
    expect(all.smsTemplateId).toBeNull();
    expect(all.contactCount).toBe(16);
  });

  it("applies All edits to every group for the occasion", () => {
    const rows = [
      baseRow("vip", "VIP", 10),
      baseRow("friend", "Friend", 6),
      baseRow("relative", "Relative", 4),
    ];

    const next = applyAllCategoryPatch(rows, {
      smsEnabled: true,
      smsTemplateId: "anniv-sms",
      sendHour: 20,
      sendMinute: 0,
    });

    expect(next.every((row) => row.smsEnabled)).toBe(true);
    expect(next.every((row) => row.smsTemplateId === "anniv-sms")).toBe(true);
    expect(next.every((row) => row.sendHour === 20)).toBe(true);
    expect(buildAllCategoryRow(next).smsTemplateId).toBe("anniv-sms");
  });
});
