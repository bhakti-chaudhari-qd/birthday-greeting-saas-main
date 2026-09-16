"use client";

import { useEffect } from "react";

import { useLocale } from "@/lib/i18n/use-locale";

/** Keeps <html lang> in sync with the stored language preference. Renders nothing. */
export function LocaleHtmlSync() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
