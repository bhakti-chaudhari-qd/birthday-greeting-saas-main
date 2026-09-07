import type { DashboardNavItem } from "@/lib/dashboard/navigation";

export const ADMIN_NAV: readonly DashboardNavItem[] = [
  { label: "Overview", href: "/admin" },
  { label: "Usage", href: "/admin/usage" },
  { label: "Organizations", href: "/admin/organizations" },
  { label: "Vendors", href: "/admin/vendors" },
  { label: "Settings", href: "/admin/settings/plan-catalogue" },
] as const;

export const ADMIN_HOME_HREF = "/admin";
