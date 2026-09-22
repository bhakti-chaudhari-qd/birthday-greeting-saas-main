import { VendorOnboardingStatus } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { CreateVendorForm } from "@/components/admin/create-vendor-form";
import {
  describeLatestVendorInvite,
  maskedVendorMobile,
} from "@/components/admin/vendor-lifecycle";
import { VendorAdminForm } from "@/components/admin/vendor-admin-form";
import type { PlatformVendorDetail } from "@/lib/admin/vendors";

function vendor(
  onboardingStatus: VendorOnboardingStatus,
  userCount = 0,
): PlatformVendorDetail {
  return {
    id: "vendor-1",
    name: "Acme Messaging",
    slug: "acme",
    mobile: "9876543210",
    referralCode: "ACME",
    onboardingStatus,
    isActive: true,
    createdAt: "2026-07-21T08:00:00.000Z",
    registrationSubmittedAt: null,
    latestInvite: null,
    userCount,
    referredOrganizationCount: 0,
    currentActiveConnectedOrganizationCount: 0,
    currentRoutedDeliveriesThisMonth: 0,
    currentRoutedMonthlyDeliverySuccessCount: 0,
    currentRoutedMonthlyDeliveryFailureCount: 0,
    currentRoutedMonthlyDeliverySuccessRatePercent: null,
  };
}

describe("platform admin vendor UI", () => {
  it("offers creation by name and mobile without exposing invite URLs", () => {
    const html = renderToStaticMarkup(<CreateVendorForm />);
    expect(html).toContain('name="name"');
    expect(html).toContain('name="mobile"');
    expect(html).toContain("Create vendor and send SMS");
    expect(html).not.toContain("registrationUrl");
    expect(html).not.toContain("/vendor/register");
  });

  it("shows only lifecycle-appropriate actions", () => {
    const draft = renderToStaticMarkup(
      <VendorAdminForm vendor={vendor(VendorOnboardingStatus.DRAFT)} />,
    );
    expect(draft).toContain("Retry invitation SMS");
    expect(draft).not.toContain(">Approve<");
    expect(draft).not.toContain("Suspend vendor");

    const pending = renderToStaticMarkup(
      <VendorAdminForm vendor={vendor(VendorOnboardingStatus.PENDING, 1)} />,
    );
    expect(pending).toContain(">Approve<");
    expect(pending).toContain(">Reject<");
    expect(pending).not.toContain("invitation SMS");

    const approved = renderToStaticMarkup(
      <VendorAdminForm vendor={vendor(VendorOnboardingStatus.APPROVED, 1)} />,
    );
    expect(approved).toContain("Suspend vendor");
    expect(approved).not.toContain(">Approve<");
  });

  it("masks mobiles and describes failed or expired invitations", () => {
    expect(maskedVendorMobile("9876543210")).toBe("******3210");
    expect(
      describeLatestVendorInvite({
        deliveryStatus: "FAILED",
        sentAt: null,
        expiresAt: "2026-07-20T00:00:00.000Z",
        revokedAt: null,
      }),
    ).toBe("Invitation not sent");
    expect(
      describeLatestVendorInvite(
        {
          deliveryStatus: "AMBIGUOUS",
          sentAt: null,
          expiresAt: "2026-07-28T00:00:00.000Z",
          revokedAt: null,
        },
        new Date("2026-07-21T00:00:00.000Z"),
      ),
    ).toBe("SMS delivery uncertain · invitation remains valid");
    expect(
      describeLatestVendorInvite(
        {
          deliveryStatus: "SENT",
          sentAt: "2026-07-19T00:00:00.000Z",
          expiresAt: "2026-07-20T00:00:00.000Z",
          revokedAt: null,
        },
        new Date("2026-07-21T00:00:00.000Z"),
      ),
    ).toBe("Latest invitation expired");
  });

  it("uses uncertain reissue messaging only for active ambiguous invites", () => {
    const active = renderToStaticMarkup(
      <VendorAdminForm
        vendor={{
          ...vendor(VendorOnboardingStatus.INVITED),
          latestInvite: {
            deliveryStatus: "AMBIGUOUS",
            sentAt: null,
            expiresAt: "2099-07-28T00:00:00.000Z",
            revokedAt: null,
          },
        }}
      />,
    );
    expect(active).toContain("Reissue SMS (delivery uncertain)");

    const expired = renderToStaticMarkup(
      <VendorAdminForm
        vendor={{
          ...vendor(VendorOnboardingStatus.INVITED),
          latestInvite: {
            deliveryStatus: "AMBIGUOUS",
            sentAt: null,
            expiresAt: "2020-07-20T00:00:00.000Z",
            revokedAt: null,
          },
        }}
      />,
    );
    expect(expired).toContain("Reissue invitation SMS");
    expect(expired).not.toContain("delivery uncertain");
  });
});
