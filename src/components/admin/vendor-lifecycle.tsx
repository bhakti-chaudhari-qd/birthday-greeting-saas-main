import type { VendorOnboardingStatus } from "@prisma/client";

import { StatusBadge } from "@/components/ui/feedback";
import type { PlatformVendorSummary } from "@/lib/admin/vendors";
import type { Locale } from "@/lib/i18n/constants";
import { getAdminVendorDict } from "@/lib/i18n/dictionaries/admin-vendor";
import { formatDisplayDate } from "@/lib/ui/datetime";

const LIFECYCLE_TONES = {
  DRAFT: "neutral",
  INVITED: "info",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
} as const;

/**
 * Server components have no synchronous access to the locale cookie (see
 * use-locale.ts), so callers that already know the locale (a client
 * component that called useLocale()) pass it explicitly; callers that don't
 * care (existing server-rendered English call sites, tests) get English.
 */
export function VendorLifecycleBadge({
  status,
  locale = "en",
}: {
  status: VendorOnboardingStatus;
  locale?: Locale;
}) {
  return (
    <StatusBadge
      label={getAdminVendorDict(locale).lifecycleLabels[status]}
      tone={LIFECYCLE_TONES[status]}
    />
  );
}

export function maskedVendorMobile(mobile: string | null) {
  return mobile ? `******${mobile.slice(-4)}` : "Not set";
}

export function isActiveAmbiguousVendorInvite(
  invite: PlatformVendorSummary["latestInvite"],
  now = new Date(),
) {
  return (
    invite?.deliveryStatus === "AMBIGUOUS" &&
    invite.revokedAt === null &&
    new Date(invite.expiresAt).getTime() > now.getTime()
  );
}

export function describeLatestVendorInvite(
  latestInvite: PlatformVendorSummary["latestInvite"],
  now = new Date(),
  locale: Locale = "en",
) {
  const dict = getAdminVendorDict(locale).latestInvite;
  if (!latestInvite) return dict.noInvitationSent;
  if (latestInvite.deliveryStatus === "FAILED") return dict.invitationNotSent;
  if (latestInvite.deliveryStatus === "PENDING") return dict.smsSendPending;
  if (latestInvite.revokedAt) return dict.invitationRevoked;
  if (new Date(latestInvite.expiresAt).getTime() <= now.getTime()) {
    return dict.invitationExpired;
  }
  if (isActiveAmbiguousVendorInvite(latestInvite, now)) {
    return dict.deliveryUncertain;
  }
  return dict.smsSentExpires(formatDisplayDate(latestInvite.expiresAt));
}
