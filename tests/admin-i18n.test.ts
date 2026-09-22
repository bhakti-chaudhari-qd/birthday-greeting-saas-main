import { describe, expect, it } from "vitest";

import { describeLatestVendorInvite } from "@/components/admin/vendor-lifecycle";
import { getAdminClientsListDict } from "@/lib/i18n/dictionaries/admin-clients-list";
import {
  getAdminHealthDict,
  translateHealthLabel,
  translateHealthReason,
} from "@/lib/i18n/dictionaries/admin-health";
import { getAdminClientNewDict } from "@/lib/i18n/dictionaries/admin-client-new";
import { getAdminOverviewDict } from "@/lib/i18n/dictionaries/admin-overview";
import { getAdminUsageDict } from "@/lib/i18n/dictionaries/admin-usage";
import { getAdminVendorDict } from "@/lib/i18n/dictionaries/admin-vendor";
import { getAdminVendorDetailDict } from "@/lib/i18n/dictionaries/admin-vendor-detail";
import { getAdminVendorNewDict } from "@/lib/i18n/dictionaries/admin-vendor-new";
import { getAdminVendorsListDict } from "@/lib/i18n/dictionaries/admin-vendors-list";
import { getShellDict } from "@/lib/i18n/dictionaries/shell";
import { LOCALES } from "@/lib/i18n/constants";

const DEVANAGARI_PATTERN = /[ऀ-ॿ]/;

describe("admin i18n: shell nav", () => {
  it("has a Hindi and Marathi label for every admin nav href", () => {
    const adminHrefs = [
      "/admin",
      "/admin/usage",
      "/admin/organizations",
      "/admin/vendors",
      "/admin/settings/plan-catalogue",
    ];

    for (const locale of ["hi", "mr"] as const) {
      const dict = getShellDict(locale);
      for (const href of adminHrefs) {
        const label = dict.navLabelsByHref[href];
        expect(label, `${locale} label for ${href}`).toBeTruthy();
        expect(label, `${locale} label for ${href} should be Devanagari`).toMatch(
          DEVANAGARI_PATTERN,
        );
      }
      expect(dict.platformAdminPortalLabel).toMatch(DEVANAGARI_PATTERN);
    }

    // English stays exactly what it always was.
    const en = getShellDict("en").navLabelsByHref;
    expect(en["/admin"]).toBe("Overview");
    expect(en["/admin/organizations"]).toBe("Clients");
  });
});

describe("admin i18n: overview dict", () => {
  it("returns Devanagari content for every locale, with numbers/labels wired through", () => {
    for (const locale of ["hi", "mr"] as const) {
      const dict = getAdminOverviewDict(locale);
      expect(dict.title).toMatch(DEVANAGARI_PATTERN);
      expect(dict.stat.clientsHint("5", "2")).toContain("5");
      expect(dict.stat.clientsHint("5", "2")).toContain("2");
      expect(dict.stat.clientsHint("5", "2")).toMatch(DEVANAGARI_PATTERN);
      expect(dict.successPercent(87)).toContain("87");
      expect(dict.noDecidedDeliveries).toMatch(DEVANAGARI_PATTERN);
    }
  });

  it("covers every locale with the same shape (compile-time already enforces this; this catches accidental empty strings)", () => {
    for (const locale of LOCALES) {
      const dict = getAdminOverviewDict(locale);
      for (const [key, value] of Object.entries(dict)) {
        if (typeof value === "string") {
          expect(value.trim().length, `${locale}.${key}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("admin i18n: vendor lifecycle + latest invite", () => {
  it("translates lifecycle labels and stays keyed to the same 5 statuses in every locale", () => {
    const statuses = ["DRAFT", "INVITED", "PENDING", "APPROVED", "REJECTED"] as const;
    for (const locale of ["hi", "mr"] as const) {
      const dict = getAdminVendorDict(locale);
      for (const status of statuses) {
        expect(dict.lifecycleLabels[status]).toMatch(DEVANAGARI_PATTERN);
      }
    }
  });

  it("describeLatestVendorInvite translates every branch and defaults to English", () => {
    const now = new Date("2026-07-20T00:00:00.000Z");

    expect(describeLatestVendorInvite(null, now)).toBe("No invitation sent");
    expect(describeLatestVendorInvite(null, now, "hi")).toMatch(DEVANAGARI_PATTERN);
    expect(describeLatestVendorInvite(null, now, "mr")).toMatch(DEVANAGARI_PATTERN);

    const failed = {
      deliveryStatus: "FAILED" as const,
      sentAt: null,
      expiresAt: "2026-07-25T00:00:00.000Z",
      revokedAt: null,
      deliveryError: "boom",
    };
    expect(describeLatestVendorInvite(failed, now, "hi")).toMatch(DEVANAGARI_PATTERN);

    const sent = {
      deliveryStatus: "SENT" as const,
      sentAt: "2026-07-19T00:00:00.000Z",
      expiresAt: "2026-07-27T00:00:00.000Z",
      revokedAt: null,
      deliveryError: null,
    };
    const sentMr = describeLatestVendorInvite(sent, now, "mr");
    expect(sentMr).toMatch(DEVANAGARI_PATTERN);
    // The expiry date itself is untranslated formatDisplayDate output, still present.
    expect(sentMr).toMatch(/\d/);
  });
});

describe("admin i18n: usage page", () => {
  it("returns Devanagari content and wires numbers through in every locale", () => {
    for (const locale of ["hi", "mr"] as const) {
      const dict = getAdminUsageDict(locale);
      expect(dict.title).toMatch(DEVANAGARI_PATTERN);
      const line = dict.reconciliation("10", "2", "1", "13");
      expect(line).toContain("10");
      expect(line).toContain("13");
      expect(line).toMatch(DEVANAGARI_PATTERN);
      expect(dict.showingOf(5, "12")).toContain("5");
      expect(dict.showingOf(5, "12")).toContain("12");
    }
  });

  it("has a translation for every DeliveryStatus enum value the page renders", () => {
    const statuses = ["SENT", "DELIVERED", "UNDELIVERED", "FAILED", "QUEUED", "READ"];
    for (const locale of ["hi", "mr"] as const) {
      const dict = getAdminUsageDict(locale);
      for (const status of statuses) {
        expect(dict.deliveryStatusLabels[status], `${locale}.${status}`).toMatch(
          DEVANAGARI_PATTERN,
        );
      }
    }
  });

  it("covers every locale with non-empty strings (catches accidental blanks)", () => {
    function checkStrings(value: unknown, path: string) {
      if (typeof value === "string") {
        expect(value.trim().length, path).toBeGreaterThan(0);
      } else if (value && typeof value === "object") {
        for (const [key, nested] of Object.entries(value)) {
          checkStrings(nested, `${path}.${key}`);
        }
      }
    }
    for (const locale of LOCALES) {
      checkStrings(getAdminUsageDict(locale), locale);
    }
  });
});

describe("admin i18n: health reasons", () => {
  it("translates every health reason code and label in Hindi and Marathi", () => {
    const reasons: Parameters<typeof translateHealthReason>[0][] = [
      { code: "CLIENT_INACTIVE" },
      { code: "NO_ROUTES_ENABLED" },
      { code: "ROUTES_NEED_SETUP" },
      { code: "SOME_ROUTES_NEED_SETUP" },
      { code: "QUEUE_FAILED_ITEMS", count: 3 },
      { code: "LOW_SUCCESS_RATE" },
      { code: "NO_ISSUES" },
      { code: "QUEUED_ITEMS_NO_ISSUES", count: 5 },
    ];
    for (const locale of ["hi", "mr"] as const) {
      for (const reason of reasons) {
        expect(
          translateHealthReason(reason, locale),
          `${locale} ${reason.code}`,
        ).toMatch(DEVANAGARI_PATTERN);
      }
      expect(translateHealthLabel("HEALTHY", locale)).toMatch(DEVANAGARI_PATTERN);
      expect(translateHealthLabel("NEEDS_ATTENTION", locale)).toMatch(
        DEVANAGARI_PATTERN,
      );
      expect(translateHealthLabel("INACTIVE", locale)).toMatch(DEVANAGARI_PATTERN);
    }

    // Counts actually get interpolated, not dropped.
    expect(
      translateHealthReason({ code: "QUEUE_FAILED_ITEMS", count: 7 }, "en"),
    ).toContain("7");

    // English defaults match the app's pre-existing text exactly (no visible change).
    expect(translateHealthReason({ code: "CLIENT_INACTIVE" }, "en")).toBe(
      "Client is inactive",
    );
    expect(translateHealthReason({ code: "NO_ISSUES" }, "en")).toBe(
      "No health issues detected",
    );
  });

  it("covers every locale for admin-health with non-empty strings", () => {
    for (const locale of LOCALES) {
      const dict = getAdminHealthDict(locale);
      expect(dict.clientInactive.trim().length).toBeGreaterThan(0);
      expect(dict.queueFailedItems(1).trim().length).toBeGreaterThan(0);
    }
  });
});

describe("admin i18n: clients list", () => {
  it("returns Devanagari content and wires values through in every locale", () => {
    for (const locale of ["hi", "mr"] as const) {
      const dict = getAdminClientsListDict(locale);
      expect(dict.title).toMatch(DEVANAGARI_PATTERN);
      expect(dict.referredBy("Acme Vendor")).toContain("Acme Vendor");
      expect(dict.referredBy("Acme Vendor")).toMatch(DEVANAGARI_PATTERN);
      expect(dict.successThisMonth(92)).toContain("92");
      expect(dict.failedThisMonth("4")).toContain("4");
    }
  });
});

describe("admin i18n: vendors list, detail, and new", () => {
  it("returns Devanagari content and wires values through for the vendors list", () => {
    for (const locale of ["hi", "mr"] as const) {
      const dict = getAdminVendorsListDict(locale);
      expect(dict.title).toMatch(DEVANAGARI_PATTERN);
      expect(dict.successPercent(75)).toContain("75");
      expect(dict.successPercent(75)).toMatch(DEVANAGARI_PATTERN);
    }
  });

  it("returns Devanagari content and wires values through for the vendor detail page", () => {
    for (const locale of ["hi", "mr"] as const) {
      const dict = getAdminVendorDetailDict(locale);
      expect(dict.backToVendors).toMatch(DEVANAGARI_PATTERN);
      expect(dict.vendorWasCreatedBut("test-issue-text")).toContain("test-issue-text");
      expect(dict.vendorWasCreatedBut("test-issue-text")).toMatch(DEVANAGARI_PATTERN);
      expect(dict.okFailed("3", "1")).toContain("3");
      expect(dict.okFailed("3", "1")).toContain("1");
      // Every action has a distinct button label, confirmation, success, and
      // failure message - not derived from one another, so check they're
      // all populated and none accidentally left in English.
      for (const [key, value] of Object.entries(dict.form)) {
        expect(value, `${locale}.form.${key}`).toMatch(DEVANAGARI_PATTERN);
      }
    }
  });

  it("returns Devanagari content for the create-vendor page and form", () => {
    for (const locale of ["hi", "mr"] as const) {
      const dict = getAdminVendorNewDict(locale);
      expect(dict.title).toMatch(DEVANAGARI_PATTERN);
      expect(dict.createVendorAndSendSms).toMatch(DEVANAGARI_PATTERN);
      expect(dict.inviteIssueUncertain).toMatch(DEVANAGARI_PATTERN);
      expect(dict.inviteIssueNotSent).toMatch(DEVANAGARI_PATTERN);
    }
  });

  it("covers every locale with non-empty strings for all three dicts", () => {
    function checkStrings(value: unknown, path: string) {
      if (typeof value === "string") {
        expect(value.trim().length, path).toBeGreaterThan(0);
      } else if (value && typeof value === "object") {
        for (const [key, nested] of Object.entries(value)) {
          checkStrings(nested, `${path}.${key}`);
        }
      }
    }
    for (const locale of LOCALES) {
      checkStrings(getAdminVendorsListDict(locale), `vendorsList.${locale}`);
      checkStrings(getAdminVendorDetailDict(locale), `vendorDetail.${locale}`);
      checkStrings(getAdminVendorNewDict(locale), `vendorNew.${locale}`);
    }
  });
});

describe("admin i18n: add client page", () => {
  it("returns Devanagari content in every locale", () => {
    for (const locale of ["hi", "mr"] as const) {
      const dict = getAdminClientNewDict(locale);
      expect(dict.title).toMatch(DEVANAGARI_PATTERN);
      expect(dict.addClient).toMatch(DEVANAGARI_PATTERN);
      expect(dict.passwordHint).toMatch(DEVANAGARI_PATTERN);
    }
    for (const locale of LOCALES) {
      const dict = getAdminClientNewDict(locale);
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim().length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });
});
