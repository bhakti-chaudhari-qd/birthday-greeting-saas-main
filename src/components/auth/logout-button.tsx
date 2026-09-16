"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getShellDict } from "@/lib/i18n/dictionaries/shell";
import { useLocale } from "@/lib/i18n/use-locale";

type LogoutButtonProps = {
  className?: string;
  logoutPath?: string;
  redirectTo?: string;
  /** When true (Organization Owner), Sign out opens a menu with both options. */
  showEverywhereOption?: boolean;
};

export function LogoutButton({
  className,
  logoutPath = "/api/auth/logout",
  redirectTo = "/login",
  showEverywhereOption = false,
}: LogoutButtonProps) {
  const router = useRouter();
  const dict = getShellDict(useLocale()).signOut;
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function runLogout(mode: "current" | "everywhere") {
    if (mode === "everywhere") {
      const confirmed = window.confirm(dict.confirmEverywhere);
      if (!confirmed) {
        return;
      }
    }

    setMenuOpen(false);
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

  function handleTriggerClick() {
    if (isSubmitting) {
      return;
    }

    if (!showEverywhereOption) {
      void runLogout("current");
      return;
    }

    setMenuOpen((open) => !open);
  }

  const buttonClass = [
    "rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 outline-none",
    "hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
    "disabled:opacity-60",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={handleTriggerClick}
        disabled={isSubmitting}
        aria-expanded={showEverywhereOption ? menuOpen : undefined}
        aria-haspopup={showEverywhereOption ? "menu" : undefined}
        aria-controls={showEverywhereOption && menuOpen ? menuId : undefined}
        className={buttonClass}
      >
        {isSubmitting ? dict.signingOut : dict.signOut}
      </button>

      {showEverywhereOption && menuOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label={dict.signOutOptions}
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm text-stone-900 hover:bg-stone-50"
            onClick={() => void runLogout("current")}
          >
            {dict.signOutThisDevice}
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm text-stone-900 hover:bg-stone-50"
            onClick={() => void runLogout("everywhere")}
          >
            {dict.signOutEverywhere}
          </button>
        </div>
      ) : null}
    </div>
  );
}
