import type { DashboardNavItem } from "@/lib/dashboard/navigation";

export const VENDOR_NAV: readonly DashboardNavItem[] = [
  { label: "Overview", href: "/vendor" },
  { label: "Referred clients", href: "/vendor/referrals" },
  { label: "Delivery insights", href: "/vendor/insights" },
] as const;

export const VENDOR_HOME_HREF = "/vendor";
