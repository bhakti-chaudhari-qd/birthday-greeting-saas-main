import type { VendorOnboardingStatus } from "@prisma/client";

import { StatusBadge } from "@/components/ui/feedback";
import type { PlatformVendorSummary } from "@/lib/admin/vendors";
import { formatDisplayDate } from "@/lib/ui/datetime";

const LIFECYCLE_TONES = {
  DRAFT: "neutral",
  INVITED: "info",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
} as const;

export function VendorLifecycleBadge({
  status,
}: {
  status: VendorOnboardingStatus;
}) {
  return <StatusBadge label={status} tone={LIFECYCLE_TONES[status]} />;
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
) {
  if (!latestInvite) return "No invitation sent";
  if (latestInvite.deliveryStatus === "FAILED") return "Latest SMS failed";
  if (latestInvite.deliveryStatus === "PENDING") return "SMS send pending";
  if (latestInvite.revokedAt) return "Latest invitation revoked";
  if (new Date(latestInvite.expiresAt).getTime() <= now.getTime()) {
    return "Latest invitation expired";
  }
  if (isActiveAmbiguousVendorInvite(latestInvite, now)) {
    return "SMS delivery uncertain · invitation remains valid";
  }
  return `SMS sent · expires ${formatDisplayDate(latestInvite.expiresAt)}`;
}
