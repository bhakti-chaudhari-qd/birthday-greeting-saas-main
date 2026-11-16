import type { DashboardNavItem } from "@/lib/dashboard/navigation";

export const ADMIN_NAV: readonly DashboardNavItem[] = [
  { label: "Overview", href: "/admin" },
  { label: "Usage", href: "/admin/usage" },
  { label: "Clients", href: "/admin/organizations" },
  { label: "Vendors", href: "/admin/vendors" },
  {
    label: "Settings",
    children: [
      { label: "Plan Catalogue", href: "/admin/settings/plan-catalogue" },
      { label: "Daily Summary", href: "/admin/settings/daily-summary" },
      { label: "Tomorrow's List", href: "/admin/settings/tomorrow-list" },
    ],
  },
] as const;

export const ADMIN_HOME_HREF = "/admin";
