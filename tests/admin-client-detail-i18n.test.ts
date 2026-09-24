import { describe, expect, it } from "vitest";

import { getAdminClientDetailDict } from "@/lib/i18n/dictionaries/admin-client-detail";
import { LOCALES } from "@/lib/i18n/constants";

const DEVANAGARI_PATTERN = /[ऀ-ॿ]/;

function checkStrings(value: unknown, path: string, locale: string): void {
  if (typeof value === "string") {
    expect(value.length, `${path} (${locale}) should not be empty`).toBeGreaterThan(0);
    return;
  }
  if (typeof value === "function") {
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      checkStrings(entry, `${path}.${key}`, locale);
    }
  }
}

describe("admin i18n: client detail", () => {
  it("every string leaf is non-empty across all locales", () => {
    for (const locale of LOCALES) {
      const dict = getAdminClientDetailDict(locale);
      checkStrings(dict, "adminClientDetail", locale);
    }
  });

  it("hi/mr static labels contain Devanagari script", () => {
    const hi = getAdminClientDetailDict("hi");
    const mr = getAdminClientDetailDict("mr");

    expect(hi.tabs.overview).toMatch(DEVANAGARI_PATTERN);
    expect(hi.opsForm.clientActive).toMatch(DEVANAGARI_PATTERN);
    expect(hi.billing.dealHistory).toMatch(DEVANAGARI_PATTERN);
    expect(hi.usersTable.name).toMatch(DEVANAGARI_PATTERN);
    expect(hi.contactsTab.addContact).toMatch(DEVANAGARI_PATTERN);

    expect(mr.tabs.overview).toMatch(DEVANAGARI_PATTERN);
    expect(mr.opsForm.clientActive).toMatch(DEVANAGARI_PATTERN);
    expect(mr.billing.dealHistory).toMatch(DEVANAGARI_PATTERN);
    expect(mr.usersTable.name).toMatch(DEVANAGARI_PATTERN);
    expect(mr.contactsTab.addContact).toMatch(DEVANAGARI_PATTERN);
  });

  it("interpolated functions correctly insert dynamic values (en)", () => {
    const dict = getAdminClientDetailDict("en");

    expect(dict.opsForm.deactivateMessage("Acme Co")).toContain("Acme Co");
    expect(dict.channelTopUp.addedSuccess("50", "SMS")).toContain("50");
    expect(dict.channelTopUp.addedSuccess("50", "SMS")).toContain("SMS");
    expect(dict.recordPayment.by("Jane Admin")).toContain("Jane Admin");
    expect(dict.usersTable.deactivateMessage("Bob", "bob@test.com")).toContain("Bob");
    expect(dict.usersTable.deactivateMessage("Bob", "bob@test.com")).toContain(
      "bob@test.com",
    );
    expect(dict.contactsTab.addedSuccess("Ishika")).toContain("Ishika");
    expect(dict.planActivation.linkCreatedSuccess("PRO")).toContain("PRO");
    expect(dict.planActivation.activatedSuccess("PRO")).toContain("PRO");
    expect(
      dict.planActivation.activateWithoutPaymentNote(30),
    ).toContain("30");
  });

  it("interpolated functions insert dynamic values in hi/mr too", () => {
    const hi = getAdminClientDetailDict("hi");
    const mr = getAdminClientDetailDict("mr");

    expect(hi.opsForm.deactivateMessage("Acme Co")).toContain("Acme Co");
    expect(hi.channelTopUp.addedSuccess("50", "SMS")).toContain("50");
    expect(mr.opsForm.deactivateMessage("Acme Co")).toContain("Acme Co");
    expect(mr.channelTopUp.addedSuccess("50", "SMS")).toContain("50");
  });

  it("English defaults match the original hardcoded strings (no behavior change)", () => {
    const dict = getAdminClientDetailDict("en");

    expect(dict.opsForm.clientActive).toBe("Client active");
    expect(dict.opsForm.approveLiveCustomHttp).toBe(
      "Approve live Custom HTTP (even on FREE)",
    );
    expect(dict.billing.activatePlan).toBe("Activate a plan");
    expect(dict.tabs.contacts).toBe("Contacts");
    expect(dict.usersTable.sendPasswordReset).toBe("Send password reset link");
    expect(dict.failedQueue.retry).toBe("Retry");
  });
});
