"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { getShellDict, type ShellDict } from "@/lib/i18n/dictionaries/shell";
import { useLocale } from "@/lib/i18n/use-locale";
import {
  DASHBOARD_NAV,
  PRODUCT_DISPLAY_NAME,
  collectNavHrefs,
  getActiveNavHref,
  isNavItemActive,
  type DashboardNavItem,
} from "@/lib/dashboard/navigation";

function translateNav(
  nav: readonly DashboardNavItem[],
  dict: ShellDict,
): DashboardNavItem[] {
  return nav.map((item) => {
    if (item.children) {
      return {
        ...item,
        label: dict.navGroupLabelsByEnglishLabel[item.label] ?? item.label,
        children: item.children.map((child) => ({
          ...child,
          label: dict.navLabelsByHref[child.href] ?? child.label,
        })),
      };
    }
    return {
      ...item,
      label: dict.navLabelsByHref[item.href] ?? item.label,
    };
  });
}

export type AppShellProps = {
  user: {
    name: string;
    email: string;
    /** Shown under the name when set (e.g. Organization Owner / Staff). */
    roleLabel?: string;
  };
  children: React.ReactNode;
  nav?: readonly DashboardNavItem[];
  homeHref?: string;
  portalLabel?: string;
  brandTitle?: string;
  logoutPath?: string;
  loginPath?: string;
  /** Organization Owners can revoke all sessions. */
  showSignOutEverywhere?: boolean;
  /**
   * Kept for portal layouts that previously used a narrow rail.
   * Navigation is always in the top bar now.
   */
  compactSidebar?: boolean;
};

function NavLink({
  href,
  label,
  active,
  onNavigate,
  variant = "stack",
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
  variant?: "stack" | "top";
}) {
  const isTop = variant === "top";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={[
        "outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isTop
          ? [
              "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium",
              active
                ? "border-stone-900 bg-stone-900 text-white hover:bg-stone-800"
                : "border-stone-300 bg-white text-stone-900 hover:bg-stone-50",
            ].join(" ")
          : [
              "block rounded-lg px-3 py-1.5 text-left text-sm font-bold tracking-tight",
              active
                ? "bg-primary text-white"
                : "bg-stone-200/80 text-stone-900 hover:bg-stone-300/70",
            ].join(" "),
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function TopNav({
  pathname,
  nav,
  exactMatchHrefs,
}: {
  pathname: string;
  nav: readonly DashboardNavItem[];
  exactMatchHrefs: ReadonlySet<string>;
}) {
  const hrefs = useMemo(() => collectNavHrefs(nav), [nav]);
  const activeHref = getActiveNavHref(pathname, hrefs, exactMatchHrefs);

  return (
    <nav
      aria-label="Primary"
      className="hidden min-w-0 items-center justify-center gap-2 justify-self-center md:flex"
    >
      {nav.map((item) => (
        <TopNavGroup key={item.label} item={item} activeHref={activeHref} />
      ))}
    </nav>
  );
}

function TopNavGroup({
  item,
  activeHref,
}: {
  item: DashboardNavItem;
  activeHref: string | null;
}) {
  const groupActive = isNavItemActive("", item, activeHref);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  if (item.children) {
    const showMenu = menuOpen;

    return (
      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          aria-expanded={showMenu}
          aria-haspopup="menu"
          aria-controls={showMenu ? menuId : undefined}
          onClick={() => setMenuOpen((current) => !current)}
          className={[
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            groupActive || menuOpen
              ? "border-stone-900 bg-stone-900 text-white hover:bg-stone-800"
              : "border-stone-300 bg-white text-stone-900 hover:bg-stone-50",
          ].join(" ")}
        >
          <span>{item.label}</span>
          <span aria-hidden className="text-xs opacity-70">
            {showMenu ? "▴" : "▾"}
          </span>
        </button>
        {showMenu ? (
          <div
            id={menuId}
            role="menu"
            aria-label={item.label}
            className="absolute left-0 z-50 mt-2 min-w-[11rem] overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
          >
            {item.children.map((child) => {
              const active = activeHref === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  role="menuitem"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    "block px-4 py-2.5 text-sm outline-none transition-colors",
                    "focus-visible:bg-stone-50",
                    active
                      ? "bg-stone-100 font-medium text-stone-900"
                      : "text-stone-900 hover:bg-stone-50",
                  ].join(" ")}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <NavLink
      href={item.href}
      label={item.label}
      active={isNavItemActive("", item, activeHref)}
      variant="top"
    />
  );
}

function MobileNav({
  pathname,
  nav,
  exactMatchHrefs,
  onNavigate,
}: {
  pathname: string;
  nav: readonly DashboardNavItem[];
  exactMatchHrefs: ReadonlySet<string>;
  onNavigate?: () => void;
}) {
  const hrefs = useMemo(() => collectNavHrefs(nav), [nav]);
  const activeHref = getActiveNavHref(pathname, hrefs, exactMatchHrefs);

  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5 px-2 py-3">
      {nav.map((item) => (
        <MobileNavGroup
          key={item.label}
          item={item}
          activeHref={activeHref}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function MobileNavGroup({
  item,
  activeHref,
  onNavigate,
}: {
  item: DashboardNavItem;
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  const groupActive = isNavItemActive("", item, activeHref);
  const [expanded, setExpanded] = useState(false);

  if (item.children) {
    const showChildren = expanded || groupActive;

    return (
      <div className="mt-2 first:mt-0">
        <button
          type="button"
          aria-expanded={showChildren}
          onClick={() => setExpanded((current) => !current)}
          className={[
            "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-xs font-bold uppercase tracking-wider outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            groupActive || showChildren
              ? "bg-stone-800 text-stone-50"
              : "bg-stone-800 text-stone-50 hover:bg-stone-700",
          ].join(" ")}
        >
          <span>{item.label}</span>
          <span aria-hidden className="text-[0.65rem] opacity-80">
            {showChildren ? "−" : "+"}
          </span>
        </button>
        {showChildren ? (
          <div className="mt-0.5 flex flex-col gap-0.5">
            {item.children.map((child) => (
              <NavLink
                key={child.href}
                href={child.href}
                label={child.label}
                active={activeHref === child.href}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <NavLink
      href={item.href}
      label={item.label}
      active={isNavItemActive("", item, activeHref)}
      onNavigate={onNavigate}
    />
  );
}

function BrandMark({
  homeHref,
  brandTitle,
  portalLabel,
  compact = false,
}: {
  homeHref: string;
  brandTitle: string;
  portalLabel?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={homeHref}
      className="block shrink-0 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      {portalLabel ? (
        <p className="text-[0.65rem] font-medium uppercase tracking-wide text-stone-500">
          {portalLabel}
        </p>
      ) : null}
      <span
        className={[
          "font-semibold tracking-tight text-stone-900",
          compact ? "text-sm" : "text-base",
        ].join(" ")}
      >
        {brandTitle}
      </span>
    </Link>
  );
}

function UserMenu({
  user,
  logoutPath,
  redirectTo,
  showEverywhereOption,
}: {
  user: AppShellProps["user"];
  logoutPath: string;
  redirectTo: string;
  showEverywhereOption: boolean;
}) {
  const router = useRouter();
  const dict = getShellDict(useLocale()).signOut;
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function runLogout(mode: "current" | "everywhere") {
    if (mode === "everywhere") {
      const confirmed = window.confirm(dict.confirmEverywhere);
      if (!confirmed) {
        return;
      }
    }

    setOpen(false);
    setIsSubmitting(true);

    try {
      await fetch(
        mode === "everywhere" ? "/api/auth/sessions/revoke-all" : logoutPath,
        { method: "POST" },
      );
      router.push(redirectTo);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={isSubmitting}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-stone-300 bg-white py-1 pl-1 pr-3 text-sm font-medium text-stone-900 outline-none hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
      >
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white"
        >
          {initial}
        </span>
        <span className="hidden max-w-[8rem] truncate sm:inline">
          {isSubmitting ? dict.signingOut : user.name}
        </span>
        <span aria-hidden className="text-xs opacity-70">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={user.name}
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
        >
          <div className="border-b border-stone-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-stone-900">
              {user.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-stone-500">
              {user.email}
            </p>
            {user.roleLabel ? (
              <span className="mt-1.5 inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                {user.roleLabel}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm text-stone-900 hover:bg-stone-50"
            onClick={() => void runLogout("current")}
          >
            {dict.signOut}
          </button>
          {showEverywhereOption ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2.5 text-left text-sm text-stone-900 hover:bg-stone-50"
              onClick={() => void runLogout("everywhere")}
            >
              {dict.signOutEverywhere}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({
  user,
  children,
  nav = DASHBOARD_NAV,
  homeHref = "/dashboard",
  portalLabel,
  brandTitle = PRODUCT_DISPLAY_NAME,
  logoutPath = "/api/auth/logout",
  loginPath = "/login",
  showSignOutEverywhere = false,
}: AppShellProps) {
  const pathname = usePathname();
  const dict = getShellDict(useLocale());
  const translatedNav = useMemo(() => translateNav(nav, dict), [nav, dict]);
  const translatedPortalLabel =
    portalLabel === "Organization"
      ? dict.organizationPortalLabel
      : portalLabel === "Platform Admin"
        ? dict.platformAdminPortalLabel
        : portalLabel;
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const mobileOpen = mobileMenuPath === pathname;
  const panelId = useId();
  const exactMatchHrefs = useMemo(() => new Set([homeHref]), [homeHref]);

  function closeMobile() {
    setMobileMenuPath(null);
  }

  function openMobile() {
    setMobileMenuPath(pathname);
  }

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuPath(null);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-[#f7f4ef] text-stone-900">
      <a
        href="#main-content"
        className="absolute left-4 top-4 z-50 -translate-y-16 rounded-full bg-white px-3 py-2 text-sm font-medium text-stone-900 shadow outline-none ring-2 ring-primary transition focus:translate-y-0"
      >
        {dict.skipToMainContent}
      </a>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="presentation">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-stone-900/35"
            onClick={closeMobile}
          />
          <aside
            id={panelId}
            className="absolute inset-y-0 left-0 flex w-[min(14rem,85vw)] flex-col border-r border-stone-200 bg-[#fbfaf7] shadow-xl"
            aria-label="Navigation menu"
          >
            <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-stone-200 px-3 py-3">
              <BrandMark
                homeHref={homeHref}
                brandTitle={brandTitle}
                portalLabel={translatedPortalLabel}
              />
              <button
                type="button"
                onClick={closeMobile}
                className="rounded-full px-2 py-1.5 text-sm font-medium text-stone-700 outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary"
              >
                {dict.close}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <MobileNav
                pathname={pathname}
                nav={translatedNav}
                exactMatchHrefs={exactMatchHrefs}
                onNavigate={closeMobile}
              />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-2 border-b border-stone-200/90 bg-[#fbfaf7]/95 px-3 py-2 backdrop-blur sm:gap-3 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-3 md:px-5">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 outline-none hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary md:hidden"
            aria-expanded={mobileOpen}
            aria-controls={panelId}
            onClick={openMobile}
          >
            {dict.menu}
          </button>

          <div className="hidden shrink-0 justify-self-start md:block">
            <BrandMark
              homeHref={homeHref}
              brandTitle={brandTitle}
              portalLabel={translatedPortalLabel}
              compact
            />
          </div>

          <div className="min-w-0 flex-1 md:hidden">
            {translatedPortalLabel ? (
              <p className="truncate text-[0.65rem] font-medium uppercase tracking-wide text-stone-500">
                {translatedPortalLabel}
              </p>
            ) : null}
            <p className="truncate text-sm font-semibold text-stone-900">
              {brandTitle}
            </p>
          </div>

          <TopNav
            pathname={pathname}
            nav={translatedNav}
            exactMatchHrefs={exactMatchHrefs}
          />

          <div className="ml-auto flex shrink-0 items-center gap-2 justify-self-end md:ml-0">
            <LanguageSwitcher className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 outline-none hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary" />
            <UserMenu
              user={user}
              logoutPath={logoutPath}
              redirectTo={loginPath}
              showEverywhereOption={showSignOutEverywhere}
            />
          </div>
        </header>

        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
