export type Locale = "en" | "hi" | "mr";

export const LOCALES: readonly Locale[] = ["en", "hi", "mr"];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  hi: "हिंदी",
  mr: "मराठी",
};

/** Non-httpOnly so both server components (via next/headers) and client code (via document.cookie) can read it. */
export const LOCALE_COOKIE = "locale";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
