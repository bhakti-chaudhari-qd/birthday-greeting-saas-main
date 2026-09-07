import { UserRole } from "@prisma/client";

export type DashboardNavChild = {
  label: string;
  href: string;
};

export type DashboardNavItem =
  | {
      label: string;
      href: string;
      children?: undefined;
    }
  | {
      label: string;
      href?: undefined;
      children: readonly DashboardNavChild[];
    };

export type DashboardHomePath = {
  step: string;
  title: string;
  description: string;
  href: string;
  cta: string;
};

/**
 * Paths that require org ADMIN (manual send, channel/automation/billing settings).
 * STAFF retains contacts, queue list, and deliveries.
 */
export const ADMIN_ONLY_NAV_HREFS: ReadonlySet<string> = new Set([
  "/dashboard/messages",
  "/dashboard/settings/greeting-routes",
  "/dashboard/settings/channels",
  "/dashboard/settings/sms",
  "/dashboard/settings/whatsapp",
  "/dashboard/settings/sms/templates",
  "/dashboard/settings/billing",
  "/dashboard/settings/occasions",
  "/dashboard/settings/contact-fields",
  "/dashboard/templates",
]);

/**
 * Customer-facing primary navigation. All hrefs map to existing routes.
 * Groups use nested links - no new hubs.
 */
export const DASHBOARD_NAV: readonly DashboardNavItem[] = [
  { label: "Today", href: "/dashboard" },
  { label: "Contacts", href: "/dashboard/contacts" },
  { label: "Send Messages", href: "/dashboard/messages" },
  { label: "Activity", href: "/dashboard/activity" },
  {
    label: "Settings",
    children: [
      { label: "Channels", href: "/dashboard/settings/channels" },
      { label: "Manage Templates", href: "/dashboard/templates" },
      { label: "Occasion Management", href: "/dashboard/settings/occasions" },
      { label: "Contact Fields", href: "/dashboard/settings/contact-fields" },
      { label: "Billing", href: "/dashboard/settings/billing" },
    ],
  },
] as const;

/** Three primary paths shown on the home screen - keep this list short. */
export const DASHBOARD_HOME_PATHS: readonly DashboardHomePath[] = [
  {
    step: "1",
    title: "Add contacts",
    description: "Add the people you want to greet.",
    href: "/dashboard/contacts",
    cta: "Open contacts",
  },
  {
    step: "2",
    title: "Messages",
    description: "Write the message, add media, and choose recipients.",
    href: "/dashboard/messages",
    cta: "Send Messages",
  },
  {
    step: "3",
    title: "Review activity",
    description: "Check upcoming, submitted, and failed greetings.",
    href: "/dashboard/activity",
    cta: "Open activity",
  },
] as const;

function filterNavItemsForRole(
  items: readonly DashboardNavItem[],
  role: UserRole,
): DashboardNavItem[] {
  if (role === UserRole.ADMIN) {
    return [...items];
  }

  const filtered: DashboardNavItem[] = [];

  for (const item of items) {
    if (item.children) {
      const children = item.children.filter(
        (child) => !ADMIN_ONLY_NAV_HREFS.has(child.href),
      );
      if (children.length === 0) {
        continue;
      }
      filtered.push({ label: item.label, children });
      continue;
    }

    if (ADMIN_ONLY_NAV_HREFS.has(item.href)) {
      continue;
    }

    filtered.push(item);
  }

  return filtered;
}

/** Nav visible for the signed-in customer role. */
export function getDashboardNavForRole(
  role: UserRole,
): readonly DashboardNavItem[] {
  return filterNavItemsForRole(DASHBOARD_NAV, role);
}

/** Home “Start here” paths for the signed-in customer role. */
export function getDashboardHomePathsForRole(
  role: UserRole,
): readonly DashboardHomePath[] {
  if (role === UserRole.ADMIN) {
    return DASHBOARD_HOME_PATHS;
  }

  return DASHBOARD_HOME_PATHS.filter(
    (path) => !ADMIN_ONLY_NAV_HREFS.has(path.href),
  ).map((path, index) => ({
    ...path,
    step: String(index + 1),
  }));
}

export const PRODUCT_DISPLAY_NAME = "Birthday Greeting";

export function collectNavHrefs(
  items: readonly DashboardNavItem[] = DASHBOARD_NAV,
): string[] {
  const hrefs: string[] = [];

  for (const item of items) {
    if (item.children) {
      for (const child of item.children) {
        hrefs.push(child.href);
      }
    } else {
      hrefs.push(item.href);
    }
  }

  return hrefs;
}

const DEFAULT_EXACT_MATCH_HREFS: ReadonlySet<string> = new Set([
  "/dashboard",
  "/admin",
  "/vendor",
]);

/** Legacy SMS/WhatsApp settings paths still highlight Settings → Channels. */
const CHANNEL_SETTINGS_NAV_HREF = "/dashboard/settings/channels";
const CHANNEL_SETTINGS_PATH_PREFIXES = [
  "/dashboard/settings/channels",
  "/dashboard/settings/sms",
  "/dashboard/settings/whatsapp",
] as const;

function isChannelSettingsPath(pathname: string): boolean {
  return CHANNEL_SETTINGS_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * True when `pathname` is covered by `href`.
 * Portal home hrefs are exact-only so nested routes do not keep Home active.
 */
export function pathnameMatchesHref(
  pathname: string,
  href: string,
  exactMatchHrefs: ReadonlySet<string> = DEFAULT_EXACT_MATCH_HREFS,
): boolean {
  const hrefPath = href.split("?")[0] ?? href;

  if (hrefPath === CHANNEL_SETTINGS_NAV_HREF && isChannelSettingsPath(pathname)) {
    return true;
  }

  if (exactMatchHrefs.has(hrefPath)) {
    return pathname === hrefPath;
  }

  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

/**
 * Longest-matching href wins so nested settings routes
 * do not also activate a parent channel link when both are present.
 */
export function getActiveNavHref(
  pathname: string,
  hrefs: readonly string[] = collectNavHrefs(),
  exactMatchHrefs: ReadonlySet<string> = DEFAULT_EXACT_MATCH_HREFS,
): string | null {
  if (
    isChannelSettingsPath(pathname) &&
    hrefs.some(
      (href) => (href.split("?")[0] ?? href) === CHANNEL_SETTINGS_NAV_HREF,
    )
  ) {
    return CHANNEL_SETTINGS_NAV_HREF;
  }

  const matches = hrefs.filter((href) =>
    pathnameMatchesHref(pathname, href, exactMatchHrefs),
  );

  if (matches.length === 0) {
    return null;
  }

  return matches.reduce((best, href) =>
    href.length > best.length ? href : best,
  );
}

export function isNavItemActive(
  pathname: string,
  item: DashboardNavItem,
  activeHref: string | null = getActiveNavHref(pathname),
): boolean {
  const activePath = activeHref?.split("?")[0] ?? null;

  if (item.children) {
    return item.children.some(
      (child) => (child.href.split("?")[0] ?? child.href) === activePath,
    );
  }

  return (item.href.split("?")[0] ?? item.href) === activePath;
}
