"use client";

import { useEffect, useState } from "react";

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./constants";

export function readLocaleCookie(): Locale {
  if (typeof document === "undefined") {
    return DEFAULT_LOCALE;
  }

  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
  const value = match ? decodeURIComponent(match[1]!) : "";
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Persists the choice and reloads so every server- and client-rendered part of the page picks it up. */
export function setLocaleAndReload(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  window.location.reload();
}

/**
 * Current site language, read from the locale cookie on mount.
 * Renders as DEFAULT_LOCALE on the server/first paint, then updates -
 * there is no server-side cookie read in this app, so a brief flash to
 * the stored language on load is expected for non-English visitors.
 */
export function useLocale(): Locale {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    // Cookie is a browser-only source read once on mount, after the
    // server-matching first paint - not state fed back from React.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(readLocaleCookie());
  }, []);

  return locale;
}
