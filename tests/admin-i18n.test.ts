import { describe, expect, it } from "vitest";

import { describeLatestVendorInvite } from "@/components/admin/vendor-lifecycle";
import { getAdminOverviewDict } from "@/lib/i18n/dictionaries/admin-overview";
import { getAdminVendorDict } from "@/lib/i18n/dictionaries/admin-vendor";
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
